import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const idDictionary = new Map<string, ObjectId>();
    const stats: any = {};

    // ID Dönüştürücü: String ise sözlüğe bakıp çevirir, geçersizse yeni ObjectId üretir.
    const getOrGenerateObjectId = (oldId: any) => {
      if (!oldId) return null;
      if (oldId === 'vakif_pickup') return oldId; // Vakıf istisnası korunuyor
      if (oldId instanceof ObjectId) return oldId;
      
      if (typeof oldId === 'string') {
        if (idDictionary.has(oldId)) return idDictionary.get(oldId);
        
        if (/^[0-9a-fA-F]{24}$/.test(oldId)) {
          return new ObjectId(oldId);
        } else {
          const newId = new ObjectId();
          idDictionary.set(oldId, newId);
          return newId;
        }
      }
      return oldId;
    };

    // İşlem fonksiyonu: _id string ise silip yeniden yazar, objectId ise update eder.
    const processCollection = async (collectionName: string, foreignKeys: string[] = []) => {
      const collection = db.collection(collectionName);
      const docs = await collection.find({}).toArray();
      let fixedCount = 0;

      for (const doc of docs) {
        const oldIdStr = String(doc._id);
        const newId = getOrGenerateObjectId(oldIdStr);
        let needsUpdate = false;

        // Yabancı anahtarları (Foreign Keys) dönüştür
        for (const key of foreignKeys) {
          if (doc[key]) {
            const updatedFk = getOrGenerateObjectId(doc[key]);
            if (updatedFk !== doc[key]) {
              doc[key] = updatedFk instanceof ObjectId ? updatedFk : String(updatedFk);
              needsUpdate = true;
            }
          }
        }

        // Kendi _id'si string veya (mixed) bozuk format ise
        if (typeof doc._id === 'string' || idDictionary.has(oldIdStr)) {
          doc._id = newId;
          await collection.insertOne(doc);
          await collection.deleteOne({ _id: oldIdStr } as any);
          fixedCount++;
        } 
        // _id sağlam ama içindeki foreign key'ler değiştiyse
        else if (needsUpdate) {
          const { _id, ...rest } = doc;
          await collection.updateOne({ _id: doc._id } as any, { $set: rest });
          fixedCount++;
        }
      }
      stats[collectionName] = fixedCount;
    };

    // --- AŞAMA 1: ANA TABLOLAR (Sözlüğü Doldurur) ---
    // Önce hiçbir yere bağlı olmayan, başkalarının bağlandığı ana tablolar onarılır.
    await processCollection('drivers');
    await processCollection('households', ['defaultDriverId']);
    await processCollection('surveys');
    
    // --- AŞAMA 2: ARA TABLOLAR (Ana tablolara bağlanır) ---
    await processCollection('route_templates', ['driverId']);
    await processCollection('routes', ['driverId']);

    // --- AŞAMA 3: UÇ TABLOLAR (En çok foreign key içeren durak tabloları) ---
    await processCollection('route_template_stops', ['templateId', 'householdId']);
    await processCollection('route_stops', ['routeId', 'householdId']);
    await processCollection('survey_responses', ['surveyId', 'householdId']);

    return NextResponse.json({ 
      success: true, 
      message: "Tüm veritabanı şeması tarandı ve ObjectId uyumsuzlukları giderildi.",
      stats
    });

  } catch (error) {
    console.error("Global Migration Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

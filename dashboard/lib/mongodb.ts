import { MongoClient, Db } from "mongodb";

// Lazily connect rather than connecting at module load time. This matters
// in this project specifically because `next build` imports route files to
// bundle them without running them -- if we connected at the top level, a
// missing MONGODB_URI would only surface as a cryptic build failure instead
// of a clear runtime error the first time a route actually needs the db.

const dbName = process.env.MONGODB_DB || "cms_command_center";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Copy .env.example to .env.local and add your MongoDB Atlas connection string."
    );
  }

  // Reuse the client across hot reloads in dev, and across warm serverless
  // invocations in production, instead of opening a new connection per request.
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

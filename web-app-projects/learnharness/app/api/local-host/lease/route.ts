import { localHostLease } from "@/src/server";
export const dynamic="force-dynamic";
export async function POST(request:Request){return localHostLease(request);}

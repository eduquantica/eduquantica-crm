import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

console.log("[NextAuth Route] Handler initializing with authOptions");

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

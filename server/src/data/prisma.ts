import "dotenv/config";
import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??= "file:../reading-room.db";

export const prisma = new PrismaClient();

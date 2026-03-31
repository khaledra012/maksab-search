import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  ragDocuments, ragChunks, ragConversationExamples, aiPersonality, googleSheetsConnections
} from "../../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export const ragKnowledgeRouter = router({
  // ===== Google Sheets =====
  listGoogleSheets: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(googleSheetsConnections).orderBy(desc(googleSheetsConnections.createdAt));
  }),

  addGoogleSheet: protectedProcedure
    .input(z.object({
      name: z.string(),
      sheetId: z.string(),
      sheetUrl: z.string(),
      tabName: z.string().optional(),
      purpose: z.enum(["rag_training", "leads_import", "products", "faq"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(googleSheetsConnections).values({
        name: input.name,
        sheetId: input.sheetId,
        sheetUrl: input.sheetUrl,
        tabName: input.tabName,
        purpose: input.purpose || "rag_training",
        isActive: true,
      });

      return { id: (result as any).insertId };
    }),

  syncGoogleSheet: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(googleSheetsConnections)
        .set({ lastSyncAt: new Date() })
        .where(eq(googleSheetsConnections.id, input.id));

      return { success: true };
    }),

  deleteGoogleSheet: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(googleSheetsConnections).where(eq(googleSheetsConnections.id, input.id));
      return { success: true };
    }),

  // ===== Documents =====
  listDocuments: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input?.isActive !== undefined) conditions.push(eq(ragDocuments.isActive, input.isActive));

      return db.select().from(ragDocuments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(ragDocuments.createdAt))
        .limit(100);
    }),

  createDocument: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      category: z.string().optional(),
      docType: z.enum(["text", "faq", "product", "policy", "example", "tone"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(ragDocuments).values({
        title: input.title,
        content: input.content,
        category: input.category || "general",
        docType: "text",
        isActive: true,
      });

      return { id: (result as any).insertId };
    }),

  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, content, ...rest } = input;
      await db.update(ragDocuments).set({
        ...rest,
        ...(content ? { content } : {}),
      }).where(eq(ragDocuments.id, id));

      return { success: true };
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(ragDocuments).where(eq(ragDocuments.id, input.id));
      return { success: true };
    }),

  // ===== Examples =====
  listExamples: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(ragConversationExamples)
        .orderBy(desc(ragConversationExamples.createdAt))
        .limit(input?.limit || 100);
    }),

  createExample: protectedProcedure
    .input(z.object({
      customerMessage: z.string().min(1),
      idealResponse: z.string().min(1),
      category: z.string().optional(),
      tone: z.enum(["formal", "friendly", "direct", "persuasive"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(ragConversationExamples).values({
        customerMessage: input.customerMessage,
        idealResponse: input.idealResponse,
        category: input.category || "general",
        tone: input.tone || "friendly",
        isActive: true,
      });

      return { id: (result as any).insertId };
    }),

  updateExample: protectedProcedure
    .input(z.object({
      id: z.number(),
      customerMessage: z.string().optional(),
      idealResponse: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...data } = input;
      await db.update(ragConversationExamples).set(data).where(eq(ragConversationExamples.id, id));
      return { success: true };
    }),

  deleteExample: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(ragConversationExamples).where(eq(ragConversationExamples.id, input.id));
      return { success: true };
    }),

  // ===== Personality =====
  getPersonality: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [personality] = await db.select().from(aiPersonality).limit(1);
    return personality || null;
  }),

  savePersonality: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      role: z.string().optional(),
      tone: z.enum(["formal", "friendly", "direct", "persuasive"]).optional(),
      systemPrompt: z.string().optional(),
      greetingMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db.select().from(aiPersonality).limit(1);
      if (existing) {
        await db.update(aiPersonality).set(input).where(eq(aiPersonality.id, existing.id));
      } else {
        await db.insert(aiPersonality).values({
          name: input.name || "مساعد ذكي",
          role: input.role || "مساعد مبيعات",
          defaultTone: "friendly",
          systemPrompt: input.systemPrompt || "",
          greetingMessage: input.greetingMessage || "مرحباً! كيف يمكنني مساعدتك؟",
          language: "ar",
        });
      }

      return { success: true };
    }),

  // ===== Stats =====
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { documents: 0, examples: 0, sheets: 0, chunks: 0 };

    const [docs, examples, sheets, chunks] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(ragDocuments),
      db.select({ count: sql<number>`count(*)` }).from(ragConversationExamples),
      db.select({ count: sql<number>`count(*)` }).from(googleSheetsConnections),
      db.select({ count: sql<number>`count(*)` }).from(ragChunks),
    ]);

    return {
      documents: docs[0]?.count ?? 0,
      examples: examples[0]?.count ?? 0,
      sheets: sheets[0]?.count ?? 0,
      chunks: chunks[0]?.count ?? 0,
    };
  }),
});

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { socialAccounts, socialConversations, socialMessages, platformCredentials } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const inboxRouter = router({
  // ===== Accounts =====
  accounts: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(socialAccounts).orderBy(desc(socialAccounts.createdAt));
    }),

    connect: protectedProcedure
      .input(z.object({
        platform: z.enum(["instagram", "tiktok", "snapchat"]),
        username: z.string(),
        accountId: z.string(),
        accessToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const result = await db.insert(socialAccounts).values({
          platform: input.platform,
          username: input.username,
          accountId: input.accountId,
          accessToken: input.accessToken,
          status: "pending",
          isActive: true,
        });

        return { id: (result as any).insertId };
      }),

    disconnect: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.update(socialAccounts)
          .set({ status: "disconnected", isActive: false })
          .where(eq(socialAccounts.id, input.id));

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.delete(socialAccounts).where(eq(socialAccounts.id, input.id));
        return { success: true };
      }),

    getOAuthUrl: protectedProcedure
      .input(z.object({
        platform: z.enum(["instagram", "tiktok", "snapchat"]),
        redirectUri: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const urls: Record<string, string> = {
          instagram: "https://api.instagram.com/oauth/authorize",
          tiktok: "https://www.tiktok.com/auth/authorize/",
          snapchat: "https://accounts.snapchat.com/accounts/oauth2/auth",
        };
        return { url: urls[input.platform] || null, platform: input.platform };
      }),
  }),

  // ===== Credentials =====
  credentials: router({
    getAll: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: platformCredentials.id,
        platform: platformCredentials.platform,
        isConfigured: platformCredentials.isConfigured,
        createdAt: platformCredentials.createdAt,
      }).from(platformCredentials);
    }),

    save: protectedProcedure
      .input(z.object({
        platform: z.enum(["instagram", "tiktok", "snapchat"]),
        appId: z.string().optional(),
        appSecret: z.string().optional(),
        extraField1: z.string().optional(),
        extraField2: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const existing = await db.select().from(platformCredentials)
          .where(eq(platformCredentials.platform, input.platform))
          .limit(1);

        if (existing.length > 0) {
          await db.update(platformCredentials).set({
            appId: input.appId,
            appSecret: input.appSecret,
            extraField1: input.extraField1,
            extraField2: input.extraField2,
            isConfigured: true,
          }).where(eq(platformCredentials.platform, input.platform));
        } else {
          await db.insert(platformCredentials).values({
            platform: input.platform,
            appId: input.appId,
            appSecret: input.appSecret,
            extraField1: input.extraField1,
            extraField2: input.extraField2,
            isConfigured: true,
          });
        }

        return { success: true };
      }),
  }),

  // ===== OAuth =====
  oauth: router({
    exchangeCode: protectedProcedure
      .input(z.object({
        platform: z.string(),
        code: z.string(),
        redirectUri: z.string().optional(),
      }))
      .mutation(async () => {
        return {
          success: false,
          message: "يحتاج إلى تكوين OAuth credentials للمنصة",
        };
      }),
  }),

  // ===== Conversations =====
  conversations: router({
    list: protectedProcedure
      .input(z.object({
        platform: z.enum(["instagram", "tiktok", "snapchat", "whatsapp"]).optional(),
        socialAccountId: z.number().optional(),
        limit: z.number().default(50),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const conditions: any[] = [];
        if (input?.platform) conditions.push(eq(socialConversations.platform, input.platform));
        if (input?.socialAccountId) conditions.push(eq(socialConversations.socialAccountId, input.socialAccountId));

        return db.select().from(socialConversations)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(socialConversations.lastMessageAt))
          .limit(input?.limit || 50);
      }),

    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        return db.select().from(socialMessages)
          .where(eq(socialMessages.conversationId, input.conversationId))
          .orderBy(desc(socialMessages.createdAt))
          .limit(input.limit);
      }),
  }),
});

import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // إعادة المحاولة مرتين فقط عند فشل الطلب
      retry: (failureCount, error) => {
        // لا تُعيد المحاولة عند خطأ UNAUTHORIZED
        if (error instanceof TRPCClientError) {
          if (error.message === UNAUTHED_ERR_MSG) return false;
          if ((error as any).data?.code === 'UNAUTHORIZED') return false;
        }
          // إعادة المحاولة عند خطأ HTML response (server restart أثناء التطوير)
        if (error instanceof TRPCClientError) {
          const isHtmlResponse = error.message?.includes('<!doctype') || error.message?.includes('<html') || error.message?.includes('not valid JSON');
          if (isHtmlResponse) return failureCount < 3; // إعادة المحاولة 3 مرات
        }
        // إعادة المحاولة مرتين فقط لأخطاء الشبكة
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 1000 * 60 * 5,
    },
    mutations: {
      retry: false,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // تجاهل خطأ "Failed to fetch" في السجل (خطأ شبكة مؤقت)
    if (error instanceof TRPCClientError && error.message === 'Failed to fetch') {
      console.warn('[API] خطأ شبكة مؤقت - جاري إعادة المحاولة...');
      return;
    }
    // تجاهل خطأ HTML response (يحدث عند server restart أثناء التطوير)
    if (error instanceof TRPCClientError) {
      const isHtmlResponse = error.message?.includes('<!doctype') || error.message?.includes('<html') || error.message?.includes('not valid JSON');
      if (isHtmlResponse) {
        console.warn('[API] السيرفر يُعيد التشغيل - جاري إعادة المحاولة...');
        return;
      }
    }
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    // تجاهل خطأ HTML response (يحدث عند server restart أثناء التطوير)
    if (error instanceof TRPCClientError) {
      const isHtmlResponse = error.message?.includes('<!doctype') || error.message?.includes('<html') || error.message?.includes('not valid JSON');
      if (isHtmlResponse) {
        console.warn('[API] السيرفر يُعيد التشغيل - جاري إعادة المحاولة...');
        return;
      }
    }
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

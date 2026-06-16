import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { PrivacyModeProvider } from "@/components/PrivacyModeProvider";
import { Layout } from "@/components/Layout";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PrivacyModeProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </PrivacyModeProvider>
  );
}

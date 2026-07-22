import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { PrivacyModeProvider } from "@/components/PrivacyModeProvider";
import { Layout } from "@/components/Layout";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PrivacyModeProvider>
      <Head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </PrivacyModeProvider>
  );
}

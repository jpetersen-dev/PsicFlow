import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

/**
 * Index page — Redirects to login.
 * PsicFlow is in closed-beta: access is by invitation only.
 */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <>
      <Head>
        <title>PsicFlow — Plataforma Clínica Psicológica</title>
        <meta name="description" content="PsicFlow: gestión clínica psicológica inteligente." />
      </Head>
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-pulse text-on-surface-variant text-sm">Redirigiendo...</div>
      </div>
    </>
  );
}

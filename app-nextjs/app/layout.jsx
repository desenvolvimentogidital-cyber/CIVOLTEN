export const metadata = {
  title: 'CIVOLTEN | Orçamento Digital',
  description: 'Simulador de orçamentos e pedidos online de elétrica e construção civil em São Paulo.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body style={{ margin: 0, background: '#0b1220', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>{children}</body></html>;
}

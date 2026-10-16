import { redirect } from 'next/navigation';

// Nesta primeira versão o formulário de testes se comunica com a API
// independente da CIVOLTEN já implantada no Supabase.
export default function HomePage() {
  redirect('/teste.html');
}

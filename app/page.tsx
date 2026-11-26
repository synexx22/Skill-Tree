import { redirect } from 'next/navigation';

// Обычно сюда запрос не доходит: next.config.ts отдаёт интерфейс прямо на «/».
export default function HomePage() {
  redirect('/legacy-app.html');
}

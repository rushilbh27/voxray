import { redirect } from 'next/navigation';

// Consolidated into main dashboard — /errors → /
export default function ErrorsPage() {
  redirect('/');
}

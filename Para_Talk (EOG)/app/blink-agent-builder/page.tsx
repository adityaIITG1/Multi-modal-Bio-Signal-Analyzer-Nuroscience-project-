import BlinkAgentBuilder from '@/components/BlinkAgentBuilder';

export const metadata = {
  title: 'BlinkAgent Builder - AI Workstation',
  description: 'Build intelligent AI agents with one blink.',
};

export default function BlinkAgentBuilderPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white overflow-hidden">
      <BlinkAgentBuilder />
    </main>
  );
}

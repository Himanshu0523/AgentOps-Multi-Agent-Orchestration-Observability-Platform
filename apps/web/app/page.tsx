'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Shield, 
  DollarSign, 
  GitBranch, 
  Eye, 
  Cpu,
  Workflow,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Cpu className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">AgentOps</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Observe, Control & Evaluate
            <span className="block text-blue-600 mt-2">Autonomous AI Agents</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AgentOps is an operations console for multi-agent AI systems. 
            Monitor execution, manage approvals, and govern costs in real-time.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Create Workspace</Button>
            </Link>
            <Button variant="outline" size="lg">View Demo</Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Platform Capabilities</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Workflow className="h-8 w-8 text-blue-600" />}
            title="Multi-Agent Orchestration"
            description="Planner, Researcher, Coder, and Reviewer agents working together with LangGraph."
          />
          <FeatureCard
            icon={<Eye className="h-8 w-8 text-green-600" />}
            title="Live Observability"
            description="Real-time trace visualization with MongoDB Change Streams and Socket.IO."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-purple-600" />}
            title="Human Approval"
            description="Risk-based approval gates with LangGraph interrupt/resume mechanism."
          />
          <FeatureCard
            icon={<DollarSign className="h-8 w-8 text-yellow-600" />}
            title="Cost Governance"
            description="Token-level cost tracking and budget enforcement per task."
          />
          <FeatureCard
            icon={<Lock className="h-8 w-8 text-red-600" />}
            title="Secure Execution"
            description="Docker sandbox isolation with tool-level permissions."
          />
          <FeatureCard
            icon={<GitBranch className="h-8 w-8 text-indigo-600" />}
            title="Replay & Evaluation"
            description="Deterministic replay with structured reviewer scoring."
          />
        </div>
      </section>

      {/* Architecture */}
      <section className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Architecture</h2>
          <div className="bg-gray-800 rounded-xl p-8 overflow-x-auto">
            <pre className="text-sm text-gray-300">
{`┌─────────────────────────────────────┐
│           Next.js Frontend          │
│   Dashboard │ Trace │ Approvals      │
└────────────────┬────────────────────┘
                 │ REST + Socket.IO
┌────────────────▼────────────────────┐
│         Node.js / Express           │
│   Auth │ Task API │ Socket Gateway  │
└──────┬────────────────────┬─────────┘
       │ HTTP               │ MongoDB
┌──────▼─────────┐          │ (Change Streams)
│  Python Agent  │          │
│  FastAPI       │          │
│  LangGraph     │          │
│  Multi-Agent   │          │
└────────────────┘          │
       │                    │
┌──────▼─────────┐  ┌───────▼─────┐
│  Redis Queue   │  │  MongoDB    │
│  Qdrant Vector │  │  Replica    │
└────────────────┘  └─────────────┘`}
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Ship AI Agents?</h2>
        <p className="text-gray-600 mb-8">Start building production-grade agent systems today.</p>
        <Link href="/register">
          <Button size="lg">Get Started Free</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>© 2024 AgentOps. Built for production AI systems.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
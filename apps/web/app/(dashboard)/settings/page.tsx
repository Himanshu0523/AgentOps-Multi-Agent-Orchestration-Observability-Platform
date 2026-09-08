'use client';

import React from 'react';
import { User, Key, Cpu, Bell, Shield, Building } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your workspace</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Navigation */}
        <Card className="p-4 h-fit">
          <nav className="space-y-1">
            <SettingsNavItem icon={<User className="h-4 w-4" />} label="Profile" active />
            <SettingsNavItem icon={<Key className="h-4 w-4" />} label="API Keys" />
            <SettingsNavItem icon={<Cpu className="h-4 w-4" />} label="Models" />
            <SettingsNavItem icon={<Bell className="h-4 w-4" />} label="Notifications" />
            <SettingsNavItem icon={<Shield className="h-4 w-4" />} label="Security" />
            <SettingsNavItem icon={<Building className="h-4 w-4" />} label="Workspace" />
          </nav>
        </Card>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="space-y-4">
              <Input
                label="Name"
                defaultValue={user?.name}
                placeholder="Your name"
              />
              <Input
                label="Email"
                type="email"
                defaultValue={user?.email}
                disabled
              />
              <Button>Save Changes</Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API Keys</h2>
            <div className="space-y-4">
              <Input
                label="OpenAI API Key"
                type="password"
                placeholder="sk-..."
              />
              <Input
                label="Anthropic API Key"
                type="password"
                placeholder="sk-ant-..."
              />
              <Button>Save API Keys</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );
}
'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Eye, Radio } from 'lucide-react';
import api from '@/lib/api';
import socketClient from '@/lib/socket';
import { Approval, ApprovalsResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const response = await api.get<ApprovalsResponse>('/approvals');
        setApprovals(response?.data?.approvals || []);
      } catch (error) {
        console.error('Failed to fetch approvals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApprovals();

    // Subscribe to live approval events via Socket.IO
    socketClient.initialize();
    const unsubCreated = socketClient.onApprovalCreated((data) => {
      if (data?.approval) {
        setApprovals((prev) => {
          if (prev.some((a) => a._id === data.approval._id)) return prev;
          return [data.approval, ...prev];
        });
      }
    });

    const unsubUpdated = socketClient.onApprovalUpdated((data) => {
      if (data?.approval) {
        setApprovals((prev) =>
          prev.map((a) => (a._id === data.approval._id ? data.approval : a))
        );
      }
    });

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, []);

  const handleApprove = async (approvalId: string) => {
    try {
      await api.post(`/approvals/${approvalId}/approve`);
      setApprovals(approvals.filter(a => a._id !== approvalId));
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (approvalId: string) => {
    try {
      await api.post(`/approvals/${approvalId}/reject`);
      setApprovals(approvals.filter(a => a._id !== approvalId));
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const pendingApprovals = approvals.filter(a => a.status === 'pending');

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <p className="text-gray-600">Human-in-the-loop control center</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
          <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
          <span>Live Change Stream Active</span>
        </div>
      </div>

      {pendingApprovals.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldAlert className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <p className="text-gray-500">No pending approvals</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((approval) => (
            <Card key={approval._id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant={getRiskVariant(approval.riskLevel)}>
                      {approval.riskLevel.toUpperCase()} RISK
                    </Badge>
                    <span className="text-sm text-gray-500">{approval.type}</span>
                  </div>
                  
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    {approval.action}
                  </p>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Agent: {approval.requestedBy}</p>
                    {Boolean(approval.details) && (
                      <pre className="text-xs bg-gray-50 rounded p-2 mt-2">
                        {JSON.stringify(approval.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye className="h-4 w-4" />}
                    onClick={() => {
                      setSelectedApproval(approval);
                      setIsModalOpen(true);
                    }}
                  >
                    View
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    icon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => handleApprove(approval._id)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<XCircle className="h-4 w-4" />}
                    onClick={() => handleReject(approval._id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Approval Details"
        size="lg"
      >
        {selectedApproval && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Action</h3>
              <p className="text-gray-900">{selectedApproval.action}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Risk Level</h3>
              <Badge variant={getRiskVariant(selectedApproval.riskLevel)}>
                {selectedApproval.riskLevel.toUpperCase()}
              </Badge>
            </div>
            {Boolean(selectedApproval.details) && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Details</h3>
                <pre className="text-sm bg-gray-50 rounded-lg p-4 overflow-auto">
                  {JSON.stringify(selectedApproval.details, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="danger"
                onClick={() => handleReject(selectedApproval._id)}
              >
                Reject
              </Button>
              <Button
                variant="success"
                onClick={() => handleApprove(selectedApproval._id)}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function getRiskVariant(risk: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (risk) {
    case 'low':
      return 'info';
    case 'medium':
      return 'warning';
    case 'high':
      return 'danger';
    case 'critical':
      return 'danger';
    default:
      return 'neutral';
  }
}
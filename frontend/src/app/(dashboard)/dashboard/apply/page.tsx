'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar as CalendarIcon, Info } from 'lucide-react';
import { addDays, format } from 'date-fns';

const applyLeaveSchema = z.object({
  leaveTypeId: z.string().min(1, 'Please select a leave type'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters'),
  attachmentUrl: z.string().optional(),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});

type ApplyLeaveForm = z.infer<typeof applyLeaveSchema>;

export default function ApplyLeavePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: leaveTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const res = await api.get('/leave-types');
      return res.data.data;
    }
  });

  const { data: balances } = useQuery({
    queryKey: ['employee-balances'],
    queryFn: async () => {
      const res = await api.get('/leave-requests/balances');
      return res.data.data;
    }
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplyLeaveForm>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: {
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      reason: '',
      leaveTypeId: '',
    }
  });

  const selectedTypeId = watch('leaveTypeId');
  const start = watch('startDate');
  const end = watch('endDate');

  // Preview requested days
  let requestedDays: number | string = 0;
  if (!start || !end || new Date(start) > new Date(end)) {
    requestedDays = '--';
  } else {
    const curDate = new Date(start);
    const endDate = new Date(end);
    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) (requestedDays as number)++;
      curDate.setDate(curDate.getDate() + 1);
    }
  }

  const selectedBalance = balances?.find((b: any) => b.leaveTypeId === selectedTypeId);
  const remainingDays = selectedBalance 
    ? selectedBalance.totalDays - selectedBalance.usedDays 
    : leaveTypes?.find((t: any) => t.id === selectedTypeId)?.defaultDays || 0;

  const selectedType = leaveTypes?.find((t: any) => t.id === selectedTypeId);
  const requiresAttachment = selectedType?.requiresAttachment;

  const mutation = useMutation({
    mutationFn: async (data: ApplyLeaveForm) => {
      // Ensure ISO string for dates (backend expects datetime string or ISO)
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      return await api.post('/leave-requests', payload);
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const onSubmit = async (data: ApplyLeaveForm) => {
    if (requiresAttachment && !file) {
      setFileError('Medical certificate is required for this leave type.');
      return;
    }

    let base64String = undefined;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFileError('File size must not exceed 5MB.');
        return;
      }
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setFileError('Only PDF, JPG, JPEG, and PNG files are allowed.');
        return;
      }
      
      try {
        base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      } catch (err) {
        setFileError('Failed to read file.');
        return;
      }
    }

    try {
      setIsProcessing(true);
      await mutation.mutateAsync({ ...data, attachmentUrl: base64String });
      toast.success('Leave request submitted successfully', { id: 'apply-success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['manager-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] })
      ]);
      reset();
      setFile(null);
      router.push('/dashboard/history');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to submit leave request', { id: 'apply-error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apply for Leave</h1>
        <p className="text-muted-foreground mt-1">Submit a new leave request</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2">
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Leave Type</label>
                <select 
                  {...register('leaveTypeId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={typesLoading}
                >
                  <option value="">Select a leave type</option>
                  {leaveTypes?.map((type: any) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
                {errors.leaveTypeId && <p className="text-xs text-destructive">{errors.leaveTypeId.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    {...register('startDate')}
                    className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    min={start || undefined}
                    {...register('endDate')}
                    className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Reason</label>
                  <span className="text-xs text-muted-foreground">{watch('reason')?.length || 0} / 300</span>
                </div>
                <textarea
                  {...register('reason')}
                  maxLength={300}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
                  placeholder="Please provide a reason for your leave..."
                />
                {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
              </div>

              {requiresAttachment && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Medical Certificate <span className="text-destructive">*</span></label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setFileError(null);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
                  />
                  {fileError && <p className="text-xs text-destructive">{fileError}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isProcessing}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-2"
              >
                {isSubmitting || isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
                Submit Request
              </button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass h-fit bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary flex items-center">
              <Info className="mr-2 h-5 w-5" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Requested Days (Working)</p>
              <p className="text-3xl font-bold text-foreground">{requestedDays}</p>
            </div>
            
            {selectedTypeId && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className={`text-2xl font-bold ${(requestedDays !== '--' && remainingDays < (requestedDays as number)) ? 'text-destructive' : 'text-green-500'}`}>
                  {remainingDays}
                </p>
                {requestedDays !== '--' && remainingDays < (requestedDays as number) && (
                  <p className="text-xs text-destructive mt-1">Insufficient balance</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

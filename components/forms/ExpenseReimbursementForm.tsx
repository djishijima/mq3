import React, { useState, useMemo, useRef } from 'react';
import { submitApplication } from '../../services/dataService.ts';
import { extractInvoiceDetails } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import AccountItemSelect from './AccountItemSelect.tsx';
import PaymentRecipientSelect from './PaymentRecipientSelect.tsx';
import DepartmentSelect from './DepartmentSelect.tsx';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle } from '../Icons.tsx';
import { User, InvoiceData, Customer, AccountItem, Job, PurchaseOrder, Department, AllocationDivision } from '../../types.ts';

interface ExpenseReimbursementFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    customers: Customer[];
    accountItems: AccountItem[];
    jobs: Job[];
    purchaseOrders: PurchaseOrder[];
    departments: Department[];
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    allocationDivisions: AllocationDivision[];
}

interface ExpenseDetail {
    id: string;
    paymentDate: string;
    paymentRecipientId: string;
    description: string;
    allocationTarget: string;
    costType: 'V' | 'F';
    accountItemId: string;
    allocationDivisionId: string;
    amount: number;
    p: number; // Price
    v: number; // Variable Cost
    q: number; // Quantity
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const ExpenseReimbursementForm: React.FC<ExpenseReimbursementFormProps> = ({ onSuccess, applicationCodeId, currentUser, customers, accountItems, jobs, purchaseOrders, departments, isAIOff, isLoading, error: formLoadError, allocationDivisions }) => {
    const [departmentId, setDepartmentId] = useState<string>('');
    const [details, setDetails] = useState<ExpenseDetail[]>([]);
    const [notes, setNotes] = useState('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
    const animationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const isDisabled = isSubmitting || isLoading || !!formLoadError;

    const totalAmount = useMemo(() => details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [details]);

    const addNewRow = () => {
        setDetails(prev => [...prev, {
            id: `row_${Date.now()}`,
            paymentDate: new Date().toISOString().split('T')[0],
            paymentRecipientId: '',
            description: '',
            allocationTarget: '',
            costType: 'F',
            accountItemId: '',
            allocationDivisionId: '',
            amount: 0,
            p: 0,
            v: 0,
            q: 1,
        }]);
    };
    
    const handleDetailChange = (id: string, field: keyof ExpenseDetail, value: string | number) => {
        setDetails(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleRemoveRow = (id: string) => setDetails(prev => prev.filter(item => item.id !== id));
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (isAIOff) {
            setError('AI機能は現在無効です。ファイルからの読み取りはできません。');
            return;
        }

        setIsOcrLoading(true);
        setError('');
        try {
            const base64String = await readFileAsBase64(file);
            const ocrData: InvoiceData = await extractInvoiceDetails(base64String, file.type, accountItems, allocationDivisions);
            
            const matchedAccountItem = accountItems.find(item => item.name === ocrData.account);
            const matchedAllocDivision = allocationDivisions.find(div => div.name === ocrData.allocationDivision);

            const newDetail: ExpenseDetail = {
                id: `row_ocr_${Date.now()}`,
                paymentDate: ocrData.invoiceDate || new Date().toISOString().split('T')[0],
                paymentRecipientId: '', // User needs to select this
                description: `【OCR読取: ${ocrData.vendorName}】${ocrData.description}`,
                allocationTarget: ocrData.project ? `job:${jobs.find(j => j.title === ocrData.project)?.id || ''}` : `customer:${customers.find(c => c.customerName === ocrData.relatedCustomer)?.id || ''}`,
                costType: ocrData.costType || 'F',
                accountItemId: matchedAccountItem?.id || '',
                allocationDivisionId: matchedAllocDivision?.id || '',
                amount: ocrData.totalAmount || 0,
                p: 0,
                v: 0,
                q: 1,
            };
            setDetails(prev => [...prev, newDetail]);

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'AI-OCR処理中にエラーが発生しました。');
        } finally {
            setIsOcrLoading(false);
            e.target.value = '';
        }
    };

    const validateForm = () => {
        const errors = new Set<string>();
        if (!departmentId) errors.add('departmentId');
        if (!approvalRouteId) errors.add('approvalRouteId');
        if (details.length === 0) errors.add('details');

        details.forEach(detail => {
            if (!detail.paymentDate) errors.add(`${detail.id}-paymentDate`);
            if (!detail.paymentRecipientId) errors.add(`${detail.id}-paymentRecipientId`);
            if (!detail.description.trim()) errors.add(`${detail.id}-description`);
            if (!detail.accountItemId) errors.add(`${detail.id}-accountItemId`);
            if (!detail.allocationDivisionId) errors.add(`${detail.id}-allocationDivisionId`);
            if (!detail.amount || detail.amount <= 0) errors.add(`${detail.id}-amount`);
        });

        return errors;
    };


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const validationErrors = validateForm();
        setValidationErrors(validationErrors);
        
        if (animationTimeoutRef.current) {
            clearTimeout(animationTimeoutRef.current);
        }
        animationTimeoutRef.current = setTimeout(() => setValidationErrors(new Set()), 1000);

        if (validationErrors.size > 0) {
            setError('赤枠で示された必須項目をすべて入力してください。');
            return;
        }

        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            const submissionData = {
                departmentId,
                details: details.filter(d => d.description.trim() || d.paymentRecipientId || d.amount),
                notes: notes,
                totalAmount: totalAmount,
            };
            await submitApplication({ applicationCodeId, formData: submissionData, approvalRouteId }, currentUser.id);
            onSuccess();
        } catch (err: any) {
            setError('申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="relative">
            {(isLoading || formLoadError) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8" aria-live="polite" aria-busy={isLoading}>
                    {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" aria-hidden="true" />}
                </div>
            )}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-8 animate-fade-in-up" aria-labelledby="form-title" noValidate>
                <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white text-center">経費精算フォーム</h2>
                
                {formLoadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}
                
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">入力エラー</p>
                        <p>{error}</p>
                    </div>
                )}

                <div className="mt-4 flex items-center gap-4">
                    <label htmlFor="ocr-file-upload" className={`relative inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${isOcrLoading || isAIOff || isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isOcrLoading ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Upload className="w-5 h-5" aria-hidden="true" />}
                        <span>{isOcrLoading ? '解析中...' : '領収書から読み取り'}</span>
                        <input id="ocr-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" disabled={isOcrLoading || isAIOff || isDisabled} aria-label="領収書ファイルアップロード" />
                    </label>
                    {isAIOff && <p className="text-sm text-red-500 dark:text-red-400 ml-4">AI機能無効のため、OCR機能は利用できません。</p>}
                    {!isAIOff && <p className="text-sm text-slate-500 dark:text-slate-400">領収書ファイルを選択すると、下の表に自動で追加されます。</p>}
                </div>
                
                <div className={`${validationErrors.has('departmentId') ? 'p-1 bg-red-100 rounded-lg shake' : ''}`}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="departmentId">部門 *</label>
                  <DepartmentSelect
                    value={departmentId}
                    onChange={setDepartmentId}
                    required
                    id="departmentId"
                  />
                </div>

                <div>
                    <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">経費明細 *</label>
                    {details.map(item => {
                        const m = (item.p || 0) - (item.v || 0);
                        const mq = m * (item.q || 0);
                        return (
                            <div key={item.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg mb-3 space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                                    <input type="date" value={item.paymentDate} onChange={e => handleDetailChange(item.id, 'paymentDate', e.target.value)} className={`${inputClass} md:col-span-2 ${validationErrors.has(`${item.id}-paymentDate`) ? 'border-red-500 shake' : ''}`} disabled={isDisabled} aria-label="支払日" />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </form>
        </div>
    );
};

// FIX: Add missing default export.
export default ExpenseReimbursementForm;
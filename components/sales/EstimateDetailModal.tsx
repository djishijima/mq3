
import React from 'react';
import { Estimate, MailOpenStatus, PostalInfo, PostalStatus, TrackingInfo, UUID } from '../../types';
import { EstimatePdfContent } from './EstimatePdfContent'; // Local import for EstimatePdfContent
import { savePostal, renderPostalLabelSvg, updateEstimate, saveTracking } from '../../services/dataService';
import { X, FileText, Loader, Pencil, Send } from '../Icons';

type Props = { 
  estimate: Estimate; 
  onClose: () => void;
  // onUpdateEstimate: (id: UUID, patch: Partial<Estimate>) => Promise<void>; // If using external update
};

const badgeByMailStatus: Record<MailOpenStatus, { label: string; dot: string }> = {
  opened:   { label: '開封済', dot: '🟢' },
  unopened: { label: '未開封', dot: '🟡' },
  forwarded:{ label: '転送済', dot: '🔵' },
};

export default function EstimateDetailModal({ estimate, onClose }: Props) {
  const [isGeneratingEmail, setIsGeneratingEmail] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isPrintingLabel, setIsPrintingLabel] = React.useState(false);
  const [currentPostal, setCurrentPostal] = React.useState<PostalInfo | undefined>(estimate.postal);
  const [currentTracking, setCurrentTracking] = React.useState<TrackingInfo | undefined>(estimate.tracking);

  const badge = badgeByMailStatus[currentTracking?.mailStatus ?? 'unopened']; // FIX: Use string literal

  React.useEffect(() => {
    setCurrentPostal(estimate.postal);
    setCurrentTracking(estimate.tracking);
  }, [estimate]);

  const handleUpdatePostalStatus = async (status: PostalStatus) => {
    if (!estimate) return;
    setIsPrintingLabel(true); // Temporarily use this for any postal update
    try {
      const updatedEstimate = await savePostal(estimate.id, { status });
      setCurrentPostal(updatedEstimate.postal);
    } catch (e) {
      console.error('Failed to update postal status:', e);
    } finally {
      setIsPrintingLabel(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!estimate || !currentPostal?.toName) return;
    setIsPrintingLabel(true);
    try {
      const svg = renderPostalLabelSvg(currentPostal.toName, currentPostal.toCompany);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postal_label_${estimate.estimateNumber}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      
      await handleUpdatePostalStatus('shipped'); // FIX: Use string literal
    } catch (e) {
      console.error('Failed to print label:', e);
    } finally {
      setIsPrintingLabel(false);
    }
  };

  const handleSendEmail = async () => {
    if (!estimate || isSendingEmail) return;
    setIsSendingEmail(true);
    try {
      // For this mock, we just simulate opening Gmail
      const subject = estimate.title;
      const body = `お客様へ\n\n見積書をご確認ください。\n\nよろしくお願いいたします。\n\n合計金額: ${estimate.grandTotal.toLocaleString()}円`;
      const mailtoUrl = `mailto:${estimate.customerName}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
      
      // Update tracking info
      await saveTracking(estimate.id, { mailStatus: 'opened', totalOpens: (currentTracking?.totalOpens ?? 0) + 1, lastEventAt: new Date().toISOString() }); // FIX: Use string literal
      setCurrentTracking(prev => prev ? { ...prev, mailStatus: 'opened', totalOpens: (prev.totalOpens ?? 0) + 1 } : undefined); // FIX: Use string literal

    } catch (e) {
      console.error('Failed to send email:', e);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 m-0 w-screen h-screen bg-[#161625] text-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a2a3f] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="px-2 py-1 bg-[#3a3a55] rounded text-sm">{'〈 前'}</button> {/* Navigation placeholder */}
            <div className="font-semibold text-lg">{estimate.title}</div>
            <button className="px-2 py-1 bg-[#3a3a55] rounded text-sm">{'次 〉'}</button> {/* Navigation placeholder */}
          </div>
          <div className="flex items-center gap-2">
            {currentTracking && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[#23233a] border border-[#3a3a55]">
                <span>{badge.dot}</span>
                <span>{badge.label}</span>
              </span>
            )}
            <button className="p-1 rounded-full hover:bg-[#2a2a3f]" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area - 2 columns */}
        <div className="grid grid-cols-[2fr_1fr] gap-3 p-3 flex-1 overflow-hidden">
          {/* 左ペイン: 見積書プレビュー */}
          <div className="h-full overflow-hidden border border-[#2a2a3f] rounded">
            <EstimatePdfContent estimate={estimate} />
          </div>

          {/* 右ペイン: 送付/郵送/トラッキング設定 */}
          <div className="h-full overflow-y-auto border border-[#2a2a3f] rounded p-3 bg-[#1E1E2F] flex flex-col gap-4">
            <div className="text-sm opacity-70 border-b border-[#2a2a3f] pb-2">送付・トラッキング設定</div>

            {/* 送付方法 */}
            <div>
              <h3 className="font-semibold text-sm mb-2">送付方法</h3>
              <div className="flex gap-3">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={estimate.deliveryMethod === 'メール送付'}
                    onChange={() => updateEstimate(estimate.id, { deliveryMethod: 'メール送付' })}
                  />
                  メールで送信
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={estimate.deliveryMethod !== 'メール送付'}
                    onChange={() => updateEstimate(estimate.id, { deliveryMethod: '郵送' })}
                  />
                  郵送で送付
                </label>
              </div>
            </div>

            {/* メール送信オプション */}
            {estimate.deliveryMethod === 'メール送付' && (
              <div className="space-y-3 p-3 border border-[#2a2a3f] rounded">
                <h4 className="font-semibold text-sm">メール設定</h4>
                <div>
                  <label className="block text-xs opacity-70 mb-1">宛先</label>
                  <input type="text" value={estimate.customerName} readOnly className="w-full bg-[#23233a] rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">件名</label>
                  <input type="text" value={estimate.title} readOnly className="w-full bg-[#23233a] rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">本文</label>
                  <textarea value={`お客様へ\n\n見積書をご確認ください。\n\nよろしくお願いいたします。\n\n合計金額: ${estimate.grandTotal.toLocaleString()}円`} readOnly rows={4} className="w-full bg-[#23233a] rounded px-2 py-1 text-sm" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <input type="checkbox" id="trackOpen" checked={currentTracking?.mailStatus !== 'unopened'} onChange={() => { /* Mock for UI */ }} /> {/* FIX: Use string literal */}
                  <label htmlFor="trackOpen">開封トラッキングタグを埋め込む</label>
                </div>
                 <button
                    className="px-3 py-2 rounded bg-[#2d6cdf] hover:bg-[#1e57c0] text-sm w-full flex items-center justify-center gap-2"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                 >
                    {isSendingEmail ? <Loader className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                    送信
                 </button>
              </div>
            )}

            {/* 郵送オプション */}
            {estimate.deliveryMethod !== 'メール送付' && (
              <div className="space-y-3 p-3 border border-[#2a2a3f] rounded">
                <h4 className="font-semibold text-sm">郵送設定</h4>
                <div>
                  <label className="block text-xs opacity-70 mb-1">郵送ステータス</label>
                  <div className="flex gap-2">
                    {(['preparing', 'shipped', 'delivered'] as const).map((s) => (
                      <button
                        key={s}
                        className={`px-2 py-1 rounded border text-xs ${currentPostal?.status === s ? 'bg-[#2d6cdf] border-[#2d6cdf]' : 'border-[#3a3a55]'}`}
                        onClick={() => handleUpdatePostalStatus(s)}
                        disabled={isPrintingLabel}
                      >
                        {s === 'preparing' ? '準備中' : s === 'shipped' ? '発送済' : '配達完了'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2">
                  <h5 className="font-semibold text-xs mb-1">宛名ラベルプレビュー</h5>
                  <div className="border border-[#3a3a55] rounded h-32 overflow-hidden bg-white text-black flex items-center justify-center">
                    {currentPostal?.labelPreviewSvg ? (
                      <div dangerouslySetInnerHTML={{ __html: currentPostal.labelPreviewSvg }} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs opacity-60 text-slate-500">ラベルプレビュー</div>
                    )}
                  </div>
                  <button 
                    className="mt-2 px-3 py-1 rounded bg-[#3a3a55] hover:bg-[#4a4a6a] text-sm w-full"
                    onClick={handlePrintLabel}
                    disabled={isPrintingLabel}
                  >
                    {isPrintingLabel ? '印刷中...' : 'ラベル印刷'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右下固定アクション（ヘッダーと重複するため、ここでは「閉じる」のみ） */}
        <div className="fixed right-4 bottom-4 flex gap-2">
          <button className="px-3 py-2 rounded bg-[#3a3a55] hover:bg-[#4a4a6a]" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

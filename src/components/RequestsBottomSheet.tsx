import { FileText, Calendar, X, Clock } from 'lucide-react';
import { useEffect } from 'react';

interface RequestsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLeaveRequest: () => void;
  onLeaveHistory: () => void;
  onDelayPermission: () => void;
}

export default function RequestsBottomSheet({
  isOpen,
  onClose,
  onLeaveRequest,
  onLeaveHistory,
  onDelayPermission
}: RequestsBottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40 bottom-sheet-backdrop"
        onClick={onClose}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 bottom-sheet-content"
        style={{
          maxWidth: '402px',
          margin: '0 auto'
        }}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900" dir="rtl">الطلبات</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <button
              onClick={() => {
                onLeaveRequest();
                onClose();
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
              dir="rtl"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-right flex-1">
                  <div className="text-base font-bold text-white">طلب إجازة</div>
                  <div className="text-sm text-white/80">تقديم طلب إجازة جديد</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                onDelayPermission();
                onClose();
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
              dir="rtl"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-right flex-1">
                  <div className="text-base font-bold text-white">إذن تأخير</div>
                  <div className="text-sm text-white/80">طلب إذن للتأخير عن موعد الحضور</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                onLeaveHistory();
                onClose();
              }}
              className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-[1.02]"
              dir="rtl"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-gray-700" />
                </div>
                <div className="text-right flex-1">
                  <div className="text-base font-bold text-gray-900">سجل الطلبات</div>
                  <div className="text-sm text-gray-600">عرض الطلبات السابقة</div>
                </div>
              </div>
            </button>
          </div>

          <div className="h-4"></div>
        </div>
      </div>

    </>
  );
}

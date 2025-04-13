import { Progress } from "@/components/ui/progress";
import { LoadingState } from '@/hooks/useSummarizationApi'; // Import type
import { UploadCloud, Loader2, XCircle } from "lucide-react";

interface UploadProgressProps {
    loadingState: LoadingState;
    progress: number;
}

export function UploadProgress({ loadingState, progress }: UploadProgressProps) {
    const isLoading = loadingState !== 'idle' && loadingState !== 'cancelling';
    const isUploading = loadingState === 'uploading';
    const isProcessing = loadingState === 'processing';
    const isCancelling = loadingState === 'cancelling';

    if (!isLoading && !isCancelling) {
        return null; // Don't render if not loading or cancelling
    }

    return (
        <div className="space-y-2 my-4">
            <Progress value={isUploading ? progress : (isProcessing || isCancelling ? 100 : 0)} className="w-full h-2 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-purple-600" />
            <p className="text-sm text-center text-blue-300 animate-pulse flex items-center justify-center gap-2">
                {isUploading && <><UploadCloud className="h-4 w-4 animate-bounce" /> Uploading ({progress}%)</>}
                {isProcessing && <><Loader2 className="h-4 w-4 animate-spin" /> Processing on server...</>}
                {isCancelling && <><XCircle className="h-4 w-4 text-red-500" /> Cancelling...</>}
            </p>
        </div>
    );
}
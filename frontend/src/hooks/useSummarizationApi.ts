import { useState, useRef, useCallback } from 'react';
import axios, { AxiosProgressEvent, CancelTokenSource } from 'axios';

// Define API URL
const API_URL = "http://localhost:5000/summarize";

export type LoadingState = 'idle' | 'uploading' | 'processing' | 'cancelling';

interface SummarizationResult {
    summary: string | null;
    modelUsed: string | null;
}

interface UseSummarizationApi {
    loadingState: LoadingState;
    uploadProgress: number;
    result: SummarizationResult | null;
    error: string | null;
    submitRequest: (file: File) => Promise<void>; // Make submit async for potential await in component
    cancelRequest: () => void;
    clearResultAndError: () => void;
}

export function useSummarizationApi(): UseSummarizationApi {
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [result, setResult] = useState<SummarizationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const cancelTokenSourceRef = useRef<CancelTokenSource | null>(null);

    const clearResultAndError = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    const cancelRequest = useCallback(() => {
        if (cancelTokenSourceRef.current) {
            setLoadingState('cancelling');
            cancelTokenSourceRef.current.cancel("Upload cancelled by user.");
            console.log("Upload cancellation requested via hook.");
        }
    }, []);

    const submitRequest = useCallback(async (file: File): Promise<void> => {
        if (!file || loadingState !== 'idle') {
            console.warn("Submit request called with no file or while busy.");
            return;
        }

        // Reset state for new submission
        clearResultAndError();
        setUploadProgress(0);
        setLoadingState('uploading');

        const formData = new FormData();
        formData.append('mediaFile', file);

        // Create a new cancel token
        cancelTokenSourceRef.current = axios.CancelToken.source();

        try {
            const response = await axios.post<{ summary: string; modelUsed: string }>(
                API_URL,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    cancelToken: cancelTokenSourceRef.current.token,
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        if (progressEvent.total) {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setUploadProgress(percentCompleted);
                            if (percentCompleted === 100 && loadingState === 'uploading') {
                                // Check against current state to avoid race conditions if needed
                                setLoadingState('processing');
                            }
                        }
                    },
                }
            );

            console.log("API Response received:", response.data);
            setResult({ summary: response.data.summary, modelUsed: response.data.modelUsed });
            setError(null);

        } catch (err: any) {
            if (axios.isCancel(err)) {
                console.log('Request canceled via hook:', err.message);
                setError(`Upload cancelled: ${err.message}`);
                setResult(null); // Clear result on cancel
                // Consider if file selection should be cleared here or in the component
            } else {
                console.error('API Hook Error:', err);
                let errorMsg = 'An unknown error occurred.';
                if (err.response) {
                    errorMsg = `Server Error (${err.response.status}): ${err.response.data?.error || 'Unknown server error'}`;
                    if (err.response.data?.details) errorMsg += ` Details: ${err.response.data.details}`;
                } else if (err.request) {
                    errorMsg = 'Network Error: Could not connect to the server.';
                } else {
                    errorMsg = `Request Setup Error: ${err.message}`;
                }
                setError(errorMsg);
                setResult(null);
            }
        } finally {
            setLoadingState('idle');
            setUploadProgress(0); // Reset progress bar after completion/error/cancel
            cancelTokenSourceRef.current = null;
        }
    }, [loadingState, clearResultAndError]); // Include loadingState in dependency array if needed

    return {
        loadingState,
        uploadProgress,
        result,
        error,
        submitRequest,
        cancelRequest,
        clearResultAndError,
    };
}
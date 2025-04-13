import { useState, useCallback } from 'react';
import { useSummarizationApi } from '@/hooks/useSummarizationApi';
import { FileUploader } from '@/components/FileUploader';
import { UploadProgress } from '@/components/UploadProgress';
import { SummaryDisplay } from '@/components/SummaryDisplay';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function App() {
    // State managed by App: the selected file
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // State and logic managed by the custom hook
    const {
        loadingState,
        uploadProgress,
        result,
        error,
        submitRequest,
        cancelRequest,
        clearResultAndError,
    } = useSummarizationApi();

    const handleFileSelect = useCallback((file: File | null) => {
        setSelectedFile(file);
        // Clear previous results/errors when file changes
        if (file) {
            clearResultAndError();
        }
    }, [clearResultAndError]); // Include hook function in dependency array

    const handleClearFile = useCallback(() => {
         setSelectedFile(null);
         clearResultAndError();
         // If a request is in progress, cancel it? Optional.
         // if (loadingState !== 'idle') cancelRequest();
    }, [clearResultAndError]); // Include hook function


    const handleSummarizeClick = () => {
        if (selectedFile) {
            submitRequest(selectedFile);
        } else {
            console.error("Summarize clicked without a file selected.");
             // Optionally set an error state specific to file selection
        }
    };

    const handleCancelClick = () => {
         cancelRequest();
         // Optionally clear file selection on cancel
         // setSelectedFile(null);
    }

    const isLoading = loadingState !== 'idle' && loadingState !== 'cancelling';
    const isCancelling = loadingState === 'cancelling';


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4 text-gray-100 font-sans">
            <Card className="w-full max-w-2xl bg-gray-800 border-gray-700 shadow-xl shadow-blue-900/20">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Groq Media Summarizer
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Upload audio or video to get a lightning-fast summary!
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {/* File Uploader Component */}
                    <FileUploader
                        selectedFile={selectedFile}
                        onFileSelect={handleFileSelect}
                        // clearFile={handleClearFile} // Pass clear handler
                        disabled={isLoading || isCancelling}
                        maxSizeMB={100} // Example limit
                    />

                     {/* Progress Display Component */}
                    <UploadProgress
                        loadingState={loadingState}
                        progress={uploadProgress}
                    />

                     {/* Submit / Cancel Buttons */}
                     <div className='flex justify-center gap-4'>
                        {!isLoading && !isCancelling ? (
                            <Button
                                onClick={handleSummarizeClick} // Use onClick, not tied to form submit now
                                disabled={!selectedFile || isLoading || isCancelling}
                                className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Summarize
                            </Button>
                        ) : (
                             <Button
                                 variant="destructive"
                                 onClick={handleCancelClick}
                                 disabled={isCancelling}
                                 className="w-1/2"
                             >
                                 {isCancelling ? 'Cancelling...' : 'Cancel Upload'}
                             </Button>
                        )}
                    </div>


                    {/* Error Display Component */}
                    <ErrorAlert error={error} />

                    {/* Summary Display Component */}
                    <SummaryDisplay summary={result?.summary ?? null} modelUsed={result?.modelUsed ?? null} />

                </CardContent>
                 <CardFooter className='text-xs text-gray-600 justify-center'>
                    Powered by Groq API
                 </CardFooter>
            </Card>
        </div>
    );
}

export default App;
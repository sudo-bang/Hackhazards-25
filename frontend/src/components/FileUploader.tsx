import React, { useRef, ChangeEvent, DragEvent } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileVideo, FileAudio, XCircle } from "lucide-react";

interface FileUploaderProps {
    onFileSelect: (file: File | null) => void; // Callback when file is selected/cleared
    selectedFile: File | null;
    disabled?: boolean;
    accept?: string; // e.g., "audio/*,video/*"
    maxSizeMB?: number; // Max size in Megabytes
}

export function FileUploader({
    onFileSelect,
    selectedFile,
    disabled = false,
    accept = "audio/*,video/*",
    maxSizeMB = 100,
}: FileUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | null>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setLocalError(null); // Clear local error on new selection attempt
        const file = event.target.files?.[0];
        if (file) {
            const maxSize = maxSizeMB * 1024 * 1024;
            if (file.size > maxSize) {
                setLocalError(`File too large (Max: ${maxSizeMB}MB)`);
                onFileSelect(null);
                 if (fileInputRef.current) fileInputRef.current.value = ""; // Clear input
                return;
            }
            onFileSelect(file);
        } else {
             onFileSelect(null); // Ensure clearing if no file selected
        }
    };

     const handleClearFile = () => {
        setLocalError(null);
        onFileSelect(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Clear the actual input element
        }
    };

     // Handle drag events
     const handleDrag = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
        } else if (e.type === "dragleave") {
        setDragActive(false);
        }
     };

     // Triggers when file is dropped
     const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        setLocalError(null);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            const maxSize = maxSizeMB * 1024 * 1024;
             if (file.size > maxSize) {
                setLocalError(`File too large (Max: ${maxSizeMB}MB)`);
                onFileSelect(null);
                return;
            }
             // Manually check accept types if needed (browser usually does this)
             const acceptedTypes = accept.split(',').map(t => t.trim());
             if (!acceptedTypes.some(type => new RegExp(type.replace('*', '.*')).test(file.type))) {
                setLocalError(`Invalid file type. Accepted: ${accept}`);
                onFileSelect(null);
                return;
             }
            onFileSelect(file);
            // Optional: update the input ref value if possible, though often not needed for drop
        } else {
             onFileSelect(null);
        }
     };


    return (
        <div className="grid w-full items-center gap-4" onDragEnter={handleDrag}>
            <div className="flex flex-col space-y-1.5">
                {/* Visually hidden actual input */}
                <Input
                    id="mediaFile-input"
                    type="file"
                    ref={fileInputRef}
                    accept={accept}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={disabled}
                />
                {/* Custom styled label acting as button/dropzone */}
                <Label
                    htmlFor="mediaFile-input"
                    className={`relative flex flex-col items-center justify-center w-full h-32 px-4 py-2 border-2 border-dashed rounded-md cursor-pointer transition-colors
                                ${disabled ? 'cursor-not-allowed opacity-50 bg-gray-700 border-gray-600' : 'border-gray-600 hover:border-blue-500 hover:bg-gray-700/50 bg-gray-700'}
                                ${dragActive ? 'border-blue-500 bg-gray-700/50' : ''}`}
                     onDragEnter={handleDrag}
                     onDragLeave={handleDrag}
                     onDragOver={handleDrag}
                     onDrop={handleDrop}
                >
                    <div className="text-center">
                        <UploadCloud className="mx-auto h-10 w-10 text-gray-500" />
                        <p className="mt-1 text-sm text-gray-400">
                             <span className="font-semibold text-blue-400">Click to upload</span> or drag & drop
                        </p>
                        <p className="text-xs text-gray-500">Audio/Video (Max {maxSizeMB}MB)</p>
                    </div>
                </Label>
                 {localError && <p className='text-xs text-red-400 text-center pt-1'>{localError}</p>}
            </div>

            {selectedFile && (
                <div className="text-sm text-gray-400 flex items-center justify-between p-2 bg-gray-700 rounded">
                    <div className='flex items-center gap-2 overflow-hidden'>
                         {selectedFile.type.startsWith('video/') ? <FileVideo className='h-4 w-4 text-purple-400 flex-shrink-0'/> : <FileAudio className='h-4 w-4 text-blue-400 flex-shrink-0' />}
                         <span className='truncate' title={selectedFile.name}>{selectedFile.name}</span>
                         <span className='text-xs text-gray-500 flex-shrink-0'>({(selectedFile.size / (1024*1024)).toFixed(2)} MB)</span>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className='h-6 w-6 p-0 text-gray-500 hover:text-red-500 flex-shrink-0'
                        onClick={handleClearFile}
                        disabled={disabled}
                        title="Clear selection"
                    >
                        <XCircle className='h-4 w-4'/>
                    </Button>
                </div>
            )}
        </div>
    );
}
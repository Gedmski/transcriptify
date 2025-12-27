'use client'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'

interface DropZoneProps {
    onFileAccepted: (file: File) => void
}

export function DropZone({ onFileAccepted }: DropZoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileAccepted(acceptedFiles[0])
        }
    }, [onFileAccepted])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
    })

    return (
        <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors flex flex-col items-center justify-center h-64 ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
        >
            <input {...getInputProps()} />
            <UploadCloud className={`h-12 w-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-700">
                {isDragActive ? "Drop the transcript here..." : "Drag & drop your transcript PDF"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
                or click to select file
            </p>
        </div>
    )
}

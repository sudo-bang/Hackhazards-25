import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react"; // Example icon

interface ErrorAlertProps {
    error: string | null;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
    if (!error) {
        return null;
    }

    return (
        <Alert variant="destructive" className='mt-4 bg-red-900/30 border-red-500/50'>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className='text-red-300'>{error}</AlertDescription>
        </Alert>
    );
}
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryDisplayProps {
    summary: string | null;
    modelUsed: string | null;
}

export function SummaryDisplay({ summary, modelUsed }: SummaryDisplayProps) {
    if (!summary) {
        return null;
    }

    // Helper to format summary text with line breaks
    const formattedSummary = summary.split('\n').map((line, index) => (
        <React.Fragment key={index}>
            {line}
            <br />
        </React.Fragment>
    ));

    return (
        <Card className="mt-6 bg-gray-700/50 border-gray-600">
            <CardHeader>
                <CardTitle className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-400">Summary</CardTitle>
                {modelUsed && <CardDescription className='text-xs text-gray-500 pt-1'>Generated using: {modelUsed}</CardDescription>}
            </CardHeader>
            <CardContent>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {formattedSummary}
                </p>
            </CardContent>
        </Card>
    );
}
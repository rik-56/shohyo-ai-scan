import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartData {
  month: string;
  income: number;
  expense: number;
}

interface ChartSectionProps {
  data: ChartData[];
}

export const ChartSection: React.FC<ChartSectionProps> = ({ data }) => {
  if (data.length === 0) return null;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="month" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar name="収入" dataKey="income" fill="#22c55e" radius={4} />
            <Bar name="支出" dataKey="expense" fill="#ef4444" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

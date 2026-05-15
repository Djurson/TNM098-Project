"use client";

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Papa from 'papaparse';

interface DataPoint {
  date: string;
  employerId: number;
  wage_expense: number;
  employee_count: number;
  // estimated_revenue: number; // Add this if you update your CSV logic
}

// **********************************************************
// NÅGONTING SKAPAR MEMORY LEAK OCH FRYSER DATORN!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// **********************************************************

export default function Page() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [selectedEmployer, setSelectedEmployer] = useState<string>("");

  useEffect(() => {
    fetch('/daily_company_prosperity.csv')
      .then(response => response.text())
      .then(csvString => {
        const result = Papa.parse(csvString, { header: true, dynamicTyping: true });
        
        // Safety fix: Filter rows that have a valid ID (even if ID is 0)
        const cleanData = result.data.filter((d: any) => d.employerId !== null && d.employerId !== undefined) as DataPoint[];
        
        // Optional: Remove the last day if it's incomplete (prevents the "crash to zero" look)
        const lastDate = cleanData[cleanData.length - 1]?.date;
        const filteredData = cleanData.filter(d => d.date !== lastDate);
        
        setData(filteredData);
        
        if (filteredData.length > 0) {
          setSelectedEmployer(String(filteredData[0].employerId));
        }
      });
  }, []);

  const employers = useMemo(() =>  Array.from(new Set(data.map(d => String(d.employerId))))
      .sort((a, b) => Number(a) - Number(b))
  , [data]);

  const filteredData = useMemo(() =>  data.filter(d => String(d.employerId) === selectedEmployer)
  , [data, selectedEmployer]);

  return (
    <div className="flex flex-col min-h-svh p-6 gap-6 bg-slate-50">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Company Prosperity Dashboard</h1>
        <p className="text-muted-foreground text-sm">Comparing workforce growth against labor expenses.</p>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <label className="font-semibold text-sm">Select Company:</label>
        <select 
          value={selectedEmployer} 
          onChange={(e) => setSelectedEmployer(e.target.value)}
          className="p-2 rounded border border-slate-200 bg-background text-sm focus:ring-2 focus:ring-blue-500"
        >
          {employers.map(id => (
            <option key={id} value={id}>Company ID: {id}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-125 bg-white p-6 rounded-xl border shadow-md">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={filteredData} 
            margin={{ top: 20, right: 40, left: 20, bottom: 20 }} // Added margins to prevent cutoff
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{fontSize: 11}} 
              tickMargin={10}
            />
            
            {/* Primary Axis: Wages */}
            <YAxis 
              yAxisId="left"
              width={80} // Give the label room to breathe
              label={{ value: 'Daily Wage Cost ($)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 13, fontWeight: 600 }} 
              tick={{fontSize: 11}}
            />
            
            {/* Secondary Axis: Employees */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              width={80}
              label={{ value: 'Employees', angle: 90, position: 'insideRight', offset: 0, fontSize: 13, fontWeight: 600 }}
              tick={{fontSize: 11}}
            />
            
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend verticalAlign="top" height={50} iconType="circle" />
            
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="wage_expense" 
              stroke="#2563eb" 
              name="Wage Expense ($)" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#2563eb' }}
              activeDot={{ r: 6 }}
            />
            
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="employee_count" 
              stroke="#ef4444" 
              name="Employee Count" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#ef4444' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
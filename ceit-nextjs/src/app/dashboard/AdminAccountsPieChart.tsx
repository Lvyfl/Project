'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/api';

Chart.register(ArcElement, Tooltip, Legend, PieController);

const SLICE_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#10b981', // emerald
  '#a855f7', // purple
  '#ef4444', // red
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#84cc16', // lime
];

export default function AdminAccountsPieChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { theme } = useTheme();
  const d = theme === 'dark';

  const [departments, setDepartments] = useState<{ departmentName: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/posts/public/department-counts')
      .then(res => setDepartments(res.data))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  const labels = departments.map(d => d.departmentName);
  const data = departments.map(d => d.count);
  const total = data.reduce((s, n) => s + n, 0);

  useEffect(() => {
    if (!canvasRef.current || labels.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: labels.map((_, i) => SLICE_COLORS[i % SLICE_COLORS.length]),
            borderColor: d ? '#18181b' : '#fff',
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: d ? '#fed7aa' : '#9a3412',
              font: { size: 12, family: 'system-ui' },
              padding: 16,
              boxWidth: 12,
              boxHeight: 12,
              borderRadius: 4,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed as number;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${val} post${val !== 1 ? 's' : ''} (${pct}%)`;
              },
            },
            backgroundColor: d ? '#27272a' : '#fff',
            titleColor: d ? '#fdba74' : '#c2410c',
            bodyColor: d ? '#fed7aa' : '#7c3aed',
            borderColor: d ? '#f9731640' : '#f9731640',
            borderWidth: 1,
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, theme]);

  const panel = d
    ? 'backdrop-blur-xl bg-zinc-900/75 border border-orange-500/20'
    : 'backdrop-blur-xl bg-white border border-orange-200 shadow-sm';
  const heading = d ? 'text-white' : 'text-black';
  const textMuted = d ? 'text-orange-200/80' : 'text-orange-700';
  const statCard = d ? 'bg-zinc-900/70 border border-orange-500/20' : 'bg-orange-50 border border-orange-200';

  return (
    <div className={`${panel} rounded-2xl p-6`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className={`${heading} text-lg font-semibold`}>Posts by Department</h3>
          <p className={`${textMuted} text-sm mt-0.5`}>Distribution of all posts across departments</p>
        </div>
        <div className={`${statCard} rounded-xl px-4 py-2 flex flex-col items-center`}>
          <span className={`text-2xl font-bold ${d ? 'text-orange-300' : 'text-orange-700'}`}>{loading ? '—' : total}</span>
          <span className={`text-xs ${textMuted}`}>Total Posts</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-56">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 gap-2">
          <span className="text-3xl">📊</span>
          <p className={`text-sm ${textMuted}`}>No posts yet.</p>
        </div>
      ) : (
        <div className="relative h-56">
          <canvas ref={canvasRef} />
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mt-5 space-y-2">
          {departments.map(({ departmentName, count }, i) => {
            const pct = ((count / total) * 100).toFixed(1);
            return (
              <div key={departmentName} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
                <span className={`flex-1 text-sm truncate ${d ? 'text-orange-100' : 'text-orange-900'}`}>{departmentName}</span>
                <span className={`text-sm font-semibold ${heading}`}>{count}</span>
                <span className={`text-xs w-12 text-right ${textMuted}`}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

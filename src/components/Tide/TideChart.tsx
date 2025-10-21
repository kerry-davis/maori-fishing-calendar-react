import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  type ChartOptions,
  type ScriptableContext,
  type ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { getUtcDateFromTideTime, type TideDataPoint } from "../../services/tideService";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler);

interface TideChartProps {
  series: TideDataPoint[];
  units: string;
  timezone?: string;
  utcOffsetSeconds?: number;
  className?: string;
  axisColor?: string;
  gridColor?: string;
}

const PRIMARY_STROKE = "rgba(100, 149, 237, 0.85)"; // cornflower blue
const PRIMARY_FILL = "rgba(100, 149, 237, 0.18)";
const POINT_COLOR = "rgba(74, 118, 212, 1)";
const GRID_COLOR = "rgba(148, 163, 184, 0.3)";

export const TideChart: React.FC<TideChartProps> = ({
  series,
  units,
  timezone,
  utcOffsetSeconds = 0,
  className = "",
  axisColor,
  gridColor,
}) => {
  const timeFormatter = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
    };

    if (timezone) {
      options.timeZone = timezone;
    }

    return new Intl.DateTimeFormat(undefined, options);
  }, [timezone]);

  const labels = useMemo(() => {
    return series.map((point) => {
      const date = getUtcDateFromTideTime(point.time, utcOffsetSeconds);
      return timeFormatter.format(date);
    });
  }, [series, timeFormatter, utcOffsetSeconds]);

  const chartData = useMemo<ChartData<"line">>(() => ({
    labels,
    datasets: [
      {
        label: "Tide height",
        data: series.map((point) => point.height),
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: POINT_COLOR,
        borderColor: PRIMARY_STROKE,
        borderWidth: 2,
        tension: 0.4,
        fill: "origin",
        backgroundColor: (context: ScriptableContext<"line">) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) {
            return PRIMARY_FILL;
          }
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, PRIMARY_FILL);
          gradient.addColorStop(1, "rgba(100, 149, 237, 0.02)");
          return gradient;
        },
        spanGaps: true,
      },
    ],
  }), [labels, series]);

  const options = useMemo<ChartOptions<"line">>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (context.parsed.y == null) {
              return "";
            }
            const height = context.parsed.y.toFixed(2);
            return `${height} ${units}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          color: () => {
            if (axisColor) return axisColor;
            const isDark = document.documentElement.classList.contains('dark') ||
                          document.body.classList.contains('dark-theme');
            return isDark ? '#e0e7ef' : '#64748b';
          },
          font: {
            size: 11,
          },
        },
      },
      y: {
        display: true,
        grid: {
          color: gridColor || GRID_COLOR,
        },
        ticks: {
          maxTicksLimit: 4,
          color: () => {
            if (axisColor) return axisColor;
            const isDark = document.documentElement.classList.contains('dark') ||
                          document.body.classList.contains('dark-theme');
            return isDark ? '#e0e7ef' : '#64748b';
          },
          font: {
            size: 11,
          },
          callback: (value) => `${Number(value).toFixed(1)} ${units}`,
        },
        border: {
          display: false,
        },
      },
    },
  }), [units]);

  return (
    <div className={`w-full h-32 sm:h-36 ${className}`}>
      <Line data={chartData} options={options} updateMode="none" />
    </div>
  );
};

export default TideChart;

import { Thermometer } from "lucide-react";

type DeviceCpuTempBadgeProps = {
    online: boolean;
    cpuTemp?: number | null;
    cpuTempUpdatedAt?: string | null;
};

type CpuTempBadgeView = {
    label: string;
    className: string;
    title: string;
};

function getDeviceCpuTempBadgeView({
    online,
    cpuTemp,
    cpuTempUpdatedAt,
}: DeviceCpuTempBadgeProps): CpuTempBadgeView {
    if (!online) {
        return {
            label: "Temp offline",
            className: "border-gray-200 bg-gray-100 text-gray-500",
            title: "Dispositivo offline",
        };
    }

    if (typeof cpuTemp !== "number" || Number.isNaN(cpuTemp)) {
        return {
            label: "Temp sin dato",
            className: "border-gray-200 bg-gray-100 text-gray-500",
            title: "Sin telemetria de temperatura",
        };
    }

    const title = cpuTempUpdatedAt
        ? `Ultima lectura: ${new Date(cpuTempUpdatedAt).toLocaleString()}`
        : "Lectura de temperatura sin timestamp";
    const label = `${cpuTemp.toFixed(1)}\u00B0C`;

    if (cpuTemp >= 75) {
        return {
            label,
            className: "border-rose-200 bg-rose-50 text-rose-700",
            title,
        };
    }

    if (cpuTemp >= 65) {
        return {
            label,
            className: "border-amber-200 bg-amber-50 text-amber-700",
            title,
        };
    }

    return {
        label,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        title,
    };
}

export function DeviceConnectivityBadge({ online }: { online: boolean }) {
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${online ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}
        >
            {online ? "online" : "offline"}
        </span>
    );
}

export function DeviceCpuTempBadge(props: DeviceCpuTempBadgeProps) {
    const temp = getDeviceCpuTempBadgeView(props);

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${temp.className}`}
            title={temp.title}
        >
            <Thermometer className="h-3 w-3" aria-hidden="true" />
            {temp.label}
        </span>
    );
}

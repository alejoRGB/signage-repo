export type ScheduleItem = {
    id?: string;
    dayOfWeek: number;
    startTime: string; // "HH:MM"
    endTime: string;   // "HH:MM"
    playlistId: string;
    playlist?: { name: string };
};


// Mock of DurationInput logic
const parseTime = (input) => {
    // Remove non-digits/colons
    const clean = input.replace(/[^\d:]/g, "");
    if (!clean) return 0;

    if (clean.includes(":")) {
        const parts = clean.split(":");
        const m = parseInt(parts[0] || "0", 10);
        const s = parseInt(parts[1] || "0", 10);
        return (m * 60) + s;
    } else {
        // Treat as minutes if integer? Or seconds?
        // The component I saw treats it as raw input, but let's assume standard behavior
        return parseInt(clean, 10);
    }
};

const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "00:10";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Simulation
console.log("--- Simulation ---");

// User inputs "10:00"
const input = "10:00";
const parsed = parseTime(input);
console.log(`User Input: "${input}" -> Parsed: ${parsed} seconds`);

// State Update
const itemState = { duration: parsed };
console.log("State:", itemState);

// Payload Construction (from PUT route)
// duration: item.duration || 10
const payloadDuration = itemState.duration || 10;
console.log(`Payload handling (val || 10): ${itemState.duration} -> ${payloadDuration}`);

// Save to DB (simulation)
const dbRecord = { duration: payloadDuration };
console.log("DB Record:", dbRecord);

// Retrieve from DB
// Frontend format
const formatted = formatTime(dbRecord.duration);
console.log(`Frontend Display: ${formatted}`);

// Edge Cases
console.log("\n--- Edge Cases ---");
const zeroCase = parseTime("00:00");
console.log(`Input "00:00" -> ${zeroCase}`);
console.log(`Payload (0 || 10) -> ${zeroCase || 10}`); // This explains why 0 becomes 10

const emptyCase = parseTime("");
console.log(`Input "" -> ${emptyCase}`);
console.log(`Payload (0 || 10) -> ${emptyCase || 10}`);

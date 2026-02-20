local mp = require("mp")
local opts = require("mp.options")
local utils = require("mp.utils")

local config = {
    session_id = "",
    start_at_ms = 0,
    duration_ms = 10000,
    hard_resync_threshold_ms = 50,
    soft_min_ms = 25,
    soft_max_ms = 50,
    deadband_ms = 25,
    warmup_loops = 3,
    k_base = 0.0003,
    max_speed_delta = 0.01,
    max_speed_delta_warmup = 0.03,
}

opts.read_options(config, "videowall")

local state = {
    warmup_remaining = tonumber(config.warmup_loops) or 3,
    last_time_pos_ms = 0,
    last_speed = 1.0,
    resync_count = 0,
    active = false,
}

local function round_to_frame(ms, frame_ms)
    if frame_ms <= 0 then
        return math.floor(ms + 0.5)
    end
    return math.floor((ms / frame_ms) + 0.5) * frame_ms
end

local function compute_target_phase(now_ms)
    if now_ms < config.start_at_ms then
        return nil
    end
    local elapsed_ms = now_ms - config.start_at_ms
    return elapsed_ms % config.duration_ms
end

local function compute_drift(actual_ms, target_ms)
    local raw = actual_ms - target_ms
    local half = config.duration_ms / 2
    if raw > half then
        raw = raw - config.duration_ms
    elseif raw < -half then
        raw = raw + config.duration_ms
    end
    return raw
end

local function get_gain(abs_drift)
    if abs_drift > 200 then
        return config.k_base * 1.5
    elseif abs_drift < 50 then
        return config.k_base * 0.7
    end
    return config.k_base
end

local function clamp(value, min_v, max_v)
    if value < min_v then return min_v end
    if value > max_v then return max_v end
    return value
end

local function emit_debug(event, data)
    local encoded = ""
    if data then
        encoded = " " .. utils.format_json(data)
    end
    mp.msg.info(string.format("[VIDEOWALL_SYNC] %s%s", event, encoded))
end

local function maybe_update_warmup(time_pos_ms)
    local near_start = time_pos_ms < 120
    local near_end_prev = state.last_time_pos_ms > (config.duration_ms - 120)
    if near_start and near_end_prev and state.warmup_remaining > 0 then
        state.warmup_remaining = state.warmup_remaining - 1
        if state.warmup_remaining == 0 then
            emit_debug("WARMUP_COMPLETE", { session_id = config.session_id })
        end
    end
end

local function apply_sync()
    if not state.active then
        return
    end

    local now_ms = math.floor(mp.get_time() * 1000)
    local target_phase_ms = compute_target_phase(now_ms)
    if not target_phase_ms then
        return
    end

    local time_pos = mp.get_property_number("time-pos", 0.0)
    local actual_phase_ms = (time_pos * 1000) % config.duration_ms
    maybe_update_warmup(actual_phase_ms)

    local drift_ms = compute_drift(actual_phase_ms, target_phase_ms)
    local abs_drift = math.abs(drift_ms)
    local in_warmup = state.warmup_remaining > 0

    local hard_threshold = in_warmup and 300 or config.hard_resync_threshold_ms
    if abs_drift >= hard_threshold then
        local frame_ms = 1000 / (mp.get_property_number("estimated-vf-fps", 60) or 60)
        local seek_to_ms = round_to_frame(target_phase_ms, frame_ms)
        mp.commandv("seek", tostring(seek_to_ms / 1000.0), "absolute", "exact")
        mp.set_property_number("speed", 1.0)
        state.resync_count = state.resync_count + 1
        emit_debug("HARD_RESYNC", {
            session_id = config.session_id,
            drift_ms = drift_ms,
            seek_to_ms = seek_to_ms,
            warmup = in_warmup,
            resync_count = state.resync_count,
        })
        state.last_time_pos_ms = actual_phase_ms
        return
    end

    if abs_drift < math.max(config.deadband_ms, config.soft_min_ms) then
        if state.last_speed ~= 1.0 then
            mp.set_property_number("speed", 1.0)
            state.last_speed = 1.0
        end
        state.last_time_pos_ms = actual_phase_ms
        return
    end

    local max_speed_delta = in_warmup and config.max_speed_delta_warmup or config.max_speed_delta
    local gain = get_gain(abs_drift)
    local speed_adjustment = -gain * drift_ms
    local target_speed = 1.0 + clamp(speed_adjustment, -max_speed_delta, max_speed_delta)

    if math.abs(target_speed - state.last_speed) > 0.002 then
        mp.set_property_number("speed", target_speed)
        state.last_speed = target_speed
        emit_debug("SOFT_CORRECTION", {
            session_id = config.session_id,
            drift_ms = drift_ms,
            speed = target_speed,
            warmup = in_warmup,
        })
    end

    state.last_time_pos_ms = actual_phase_ms
end

local function on_file_loaded()
    state.active = config.session_id ~= ""
    state.warmup_remaining = tonumber(config.warmup_loops) or 3
    state.last_time_pos_ms = 0
    state.last_speed = 1.0
    emit_debug("READY", {
        session_id = config.session_id,
        start_at_ms = config.start_at_ms,
        duration_ms = config.duration_ms,
    })
end

mp.register_event("file-loaded", on_file_loaded)
mp.add_periodic_timer(0.2, apply_sync)

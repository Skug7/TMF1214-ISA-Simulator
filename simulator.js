// ============================================================
//  TMF1214 – Web-Based ISA Simulator  (Extended Version)
//  Supports: LOAD, ADD, SUB, MUL, DIV, JUMP, BEQ, HALT
//  Features: Float/Fraction support, Division-by-Zero trap,
//            Invalid-Register trap, comment lines (;)
// ============================================================

// ── 1. HARDWARE STATE ────────────────────────────────────────
let cpu = {
    registers: new Array(16).fill(0),  // R0 – R15 (16 registers)
    pc: 0,                             // Program Counter
    halted: false
};

const MAX_REGISTERS = 16;
const MAX_STEPS     = 10000;           // Infinite-loop guard

// ── 2. HELPER: parse a register name → index ─────────────────
function parseReg(token) {
    if (!/^R\d+$/i.test(token)) {
        throw new Error('Invalid register token: "' + token + '"');
    }
    const idx = parseInt(token.slice(1));
    if (idx < 0 || idx >= MAX_REGISTERS) {
        throw new Error('Invalid Register: "' + token + '" — only R0–R' + (MAX_REGISTERS - 1) + ' exist');
    }
    return idx;
}

// ── 3. EXECUTE ONE INSTRUCTION ───────────────────────────────
// Returns: true  → advance PC normally
//          false → PC was already set by a branch/jump
function execute(instr, args) {
    switch (instr.toUpperCase()) {

        case "LOAD": {
            const dest = parseReg(args[0]);
            const val  = parseFloat(args[1]);
            if (isNaN(val)) throw new Error('LOAD: invalid value "' + args[1] + '"');
            cpu.registers[dest] = val;
            return true;
        }

        case "ADD": {
            const dest = parseReg(args[0]);
            const s1   = parseReg(args[1]);
            const s2   = parseReg(args[2]);
            cpu.registers[dest] = cpu.registers[s1] + cpu.registers[s2];
            return true;
        }

        case "SUB": {
            const dest = parseReg(args[0]);
            const s1   = parseReg(args[1]);
            const s2   = parseReg(args[2]);
            cpu.registers[dest] = cpu.registers[s1] - cpu.registers[s2];
            return true;
        }

        case "MUL": {
            const dest = parseReg(args[0]);
            const s1   = parseReg(args[1]);
            const s2   = parseReg(args[2]);
            cpu.registers[dest] = cpu.registers[s1] * cpu.registers[s2];
            return true;
        }

        case "DIV": {
            const dest = parseReg(args[0]);
            const s1   = parseReg(args[1]);
            const s2   = parseReg(args[2]);
            if (cpu.registers[s2] === 0) {
                throw new Error('Division by Zero: ' + args[1] + ' / ' + args[2] + ' (' + args[2] + ' = 0)');
            }
            cpu.registers[dest] = cpu.registers[s1] / cpu.registers[s2];
            return true;
        }

        case "JUMP": {
            const target = parseInt(args[0]) - 1;
            if (isNaN(target) || target < 0) {
                throw new Error('JUMP: invalid line number "' + args[0] + '"');
            }
            cpu.pc = target;
            return false;
        }

        case "BEQ": {
            const s1     = parseReg(args[0]);
            const s2     = parseReg(args[1]);
            const target = parseInt(args[2]) - 1;
            if (isNaN(target) || target < 0) {
                throw new Error('BEQ: invalid line number "' + args[2] + '"');
            }
            if (cpu.registers[s1] === cpu.registers[s2]) {
                cpu.pc = target;
                return false;
            }
            return true;
        }

        case "HALT": {
            cpu.halted = true;
            return true;
        }

        default:
            throw new Error('Unknown Instruction: "' + instr + '"');
    }
}

// ── 4. MAIN RUN LOOP ─────────────────────────────────────────
// Uses setTimeout chunks so the browser never freezes —
// buttons stay responsive even if the program loops many times.

let _runTimeout = null;

function stopExecution() {
    if (_runTimeout !== null) {
        clearTimeout(_runTimeout);
        _runTimeout = null;
        log('⏹ Execution stopped by user.', 'warn');
        updateUI();
    }
}

function runProgram() {
    // Cancel any currently running program first
    if (_runTimeout !== null) {
        clearTimeout(_runTimeout);
        _runTimeout = null;
    }

    const rawCode = document.getElementById('code').value;

    // Keep all lines so line numbers match the raw source (comments = NOP, blank = NOP).
    // Inline comments are stripped but the line itself stays, preserving line numbering.
    // This matches how Fig.2 in the project spec numbers its lines.
    const lines = rawCode.split('\n')
        .map(function(line) { return line.trim().split(';')[0].trim(); });
        // Empty strings after stripping = NOP lines (blank / comment-only), still counted.

    // Reset hardware
    cpu.registers = new Array(MAX_REGISTERS).fill(0);
    cpu.pc        = 0;
    cpu.halted    = false;

    clearConsole();
    log('▶ Program started', 'info');

    var steps = 0;
    var CHUNK = 200;   // instructions per tick — keeps UI responsive

    function runChunk() {
        try {
            var chunkCount = 0;

            while (cpu.pc < lines.length && !cpu.halted) {

                if (++steps > MAX_STEPS) {
                    throw new Error(
                        'Execution limit reached (' + MAX_STEPS + ' steps). ' +
                        'Possible infinite loop — did you forget a HALT?'
                    );
                }

                var line  = lines[cpu.pc];

                // Skip blank / comment-only lines (they act as NOPs)
                if (!line || line === '') {
                    cpu.pc++;
                    continue;
                }

                var parts = line.split(/\s+/);
                var instr = parts[0].toUpperCase();
                var args  = parts.slice(1);

                var pcBefore   = cpu.pc;
                var advancePC  = execute(instr, args);

                log(
                    '  [L' + (pcBefore + 1) + '] ' + line + '  →  R[' +
                    cpu.registers.map(function(r) {
                        return Number.isInteger(r) ? r : r.toFixed(4);
                    }).join(', ') + ']',
                    'trace'
                );

                if (advancePC) cpu.pc++;

                if (++chunkCount >= CHUNK) {
                    // Yield to browser so buttons stay clickable
                    updateUI();
                    _runTimeout = setTimeout(runChunk, 0);
                    return;
                }
            }

            // Done
            _runTimeout = null;
            if (cpu.halted) {
                log('⏹ HALT reached', 'info');
            } else {
                log('✔ Program finished (end of code)', 'info');
            }
            log(
                'Final Registers: ' +
                cpu.registers.map(function(r, i) {
                    return 'R' + i + '=' + (Number.isInteger(r) ? r : parseFloat(r.toFixed(6)));
                }).join('  '),
                'result'
            );
            updateUI();

        } catch (err) {
            _runTimeout = null;
            log('🚨 TRAP — ' + err.message, 'error');
            log('Execution halted due to error.', 'error');
            updateUI();
        }
    }

    runChunk();
}

// ── 5. UI HELPERS ────────────────────────────────────────────
function updateUI() {
    var regEl = document.getElementById('registers');
    regEl.innerHTML = cpu.registers.map(function(val, i) {
        var display = Number.isInteger(val) ? val : parseFloat(val.toFixed(6));
        return '<span class="reg"><span class="reg-name">R' + i + '</span><span class="reg-val">' + display + '</span></span>';
    }).join('');

    document.getElementById('pc').innerHTML = 'Program Counter: <span>' + cpu.pc + '</span>';
}

function log(msg, type) {
    type = type || 'normal';
    var el   = document.getElementById('console');
    var line = document.createElement('div');
    line.className  = 'log-line log-' + type;
    line.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

function clearConsole() {
    document.getElementById('console').innerHTML = '';
}

function clearAll() {
    stopExecution();   // also cancels any running program
    clearConsole();
    cpu.registers = new Array(MAX_REGISTERS).fill(0);
    cpu.pc        = 0;
    cpu.halted    = false;
    updateUI();
}

// ── 6. LOAD CHALLENGE SCRIPT ─────────────────────────────────
function loadChallenge() {
    stopExecution();
    // Matches Fig.2 from project spec EXACTLY.
    // Line numbers include comment and blank lines (they act as NOPs).
    // Line 1:  ; Phase 1 & 2: Calculate (15.5 / 2) + 10   (comment = NOP)
    // Line 2:  LOAD R1 15.5
    // Line 3:  LOAD R2 2
    // Line 4:  DIV R3 R1 R2
    // Line 5:  LOAD R4 10
    // Line 6:  ADD R5 R3 R4
    // Line 7:  (blank)
    // Line 8:  ; Phase 3: Multiply R5 by 3 using a loop    (comment = NOP)
    // Line 9:  LOAD R0 0
    // Line 10: LOAD R6 3
    // Line 11: LOAD R7 1
    // Line 12: (blank)
    // Line 13: ; --- Loop Start (Line 8) ---               (comment = NOP)
    // Line 14: ADD R0 R0 R5   ← BUT Fig.2 says JUMP 8 goes here...
    //
    // Fig.2 says "Loop Start (Line 8)" and "JUMP 8" — this means the figure
    // is counting ONLY instruction lines (not comments/blanks).
    // So we match Fig.2 exactly by stripping comments, giving:
    // Instr Line 1: LOAD R1 15.5
    // Instr Line 2: LOAD R2 2
    // Instr Line 3: DIV R3 R1 R2
    // Instr Line 4: LOAD R4 10
    // Instr Line 5: ADD R5 R3 R4
    // Instr Line 6: LOAD R0 0
    // Instr Line 7: LOAD R6 3
    // Instr Line 8: LOAD R7 1
    // Instr Line 9: ADD R0 R0 R5   ← loop body start
    // Instr Line 10: SUB R6 R6 R7
    // Instr Line 11: BEQ R6 R10 13  → jump to line 13 = HALT
    // Instr Line 12: JUMP 9         → loop back to ADD
    // Instr Line 13: HALT
    // Line map (raw lines, 1-based):
    //  1: ; Phase 1 & 2 comment  (NOP)
    //  2: LOAD R1 15.5
    //  3: LOAD R2 2
    //  4: DIV R3 R1 R2
    //  5: LOAD R4 10
    //  6: ADD R5 R3 R4
    //  7: (blank)               (NOP)
    //  8: ; Phase 3 comment      (NOP)
    //  9: LOAD R0 0
    // 10: LOAD R6 3
    // 11: LOAD R7 1
    // 12: (blank)               (NOP)
    // 13: ; Loop Start comment   (NOP)
    // 14: ADD R0 R0 R5           ← loop body start
    // 15: SUB R6 R6 R7
    // 16: BEQ R6 R10 18         ← jump to HALT (line 18)
    // 17: JUMP 14               ← loop back
    // 18: (blank)               (NOP)
    // 19: HALT
    document.getElementById('code').value =
'; Phase 1 & 2: Calculate (15.5 / 2) + 10\n' +
'LOAD R1 15.5\n' +
'LOAD R2 2\n' +
'DIV R3 R1 R2        ; R3 = 7.75\n' +
'LOAD R4 10\n' +
'ADD R5 R3 R4        ; R5 = 17.75 (This is our "Base")\n' +
'\n' +
'; Phase 3: Multiply R5 by 3 using a loop\n' +
'LOAD R0 0           ; R0 will be our Final Result (Accumulator)\n' +
'LOAD R6 3           ; R6 is our Loop Counter\n' +
'LOAD R7 1           ; Constant for decrementing\n' +
'\n' +
'; --- Loop Start (Line 14) ---\n' +
'ADD R0 R0 R5        ; Add 17.75 to the total\n' +
'SUB R6 R6 R7        ; Decrement the counter\n' +
'BEQ R6 R10 19       ; If counter is 0 (R10 is empty/0), jump to HALT\n' +
'JUMP 14             ; Else, go back to Line 14\n' +
'\n' +
'HALT                ; Final R0 should be 53.25';
    clearConsole();
    log('Challenge loaded! Click Execute to run.', 'info');
    log('Expected result: R0 = 53.25', 'info');
}

// Initialize UI on page load
window.onload = function() { updateUI(); };

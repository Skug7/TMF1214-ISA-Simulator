//  TMF1214 – Web-Based ISA Simulator  (Extended Version)
//  Supports: LOAD, ADD, SUB, MUL, DIV, JUMP, BEQ, HALT
//  Features: Float/Fraction support, Division-by-Zero trap,
//            Invalid-Register trap, comment lines (;)

// ── 1. HARDWARE STATE ────────────────────────────────────────
let cpu = {
    registers: new Array(8).fill(0),   // R0 – R7 (8 registers)
    pc: 0,                             // Program Counter
    halted: false
};

const MAX_REGISTERS = 8;
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

    // Strip comments and blank lines; JUMP/BEQ line numbers count only real instructions
    const lines = rawCode.split('\n')
        .map(function(line) { return line.trim().split(';')[0].trim(); })
        .filter(function(line) { return line !== ''; });

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
    // Real instruction line numbers (comments/blanks excluded):
    // 1  LOAD R1 15.5
    // 2  LOAD R2 2
    // 3  DIV R3 R1 R2      R3 = 7.75
    // 4  LOAD R4 10
    // 5  ADD R5 R3 R4      R5 = 17.75
    // 6  LOAD R0 0
    // 7  LOAD R6 3
    // 8  LOAD R7 1
    // 9  ADD R0 R0 R5      loop start
    // 10 SUB R6 R6 R7
    // 11 LOAD R2 0
    // 12 BEQ R6 R2 14      exit when counter = 0
    // 13 JUMP 9             else loop
    // 14 HALT               R0 = 53.25
    document.getElementById('code').value =
'; Phase 1 & 2: Calculate (15.5 / 2) + 10\n' +
'LOAD R1 15.5        ; Line 1\n' +
'LOAD R2 2           ; Line 2\n' +
'DIV R3 R1 R2        ; Line 3 — R3 = 7.75\n' +
'LOAD R4 10          ; Line 4\n' +
'ADD R5 R3 R4        ; Line 5 — R5 = 17.75 (Base)\n' +
'\n' +
'; Phase 3: Multiply R5 by 3 using a BEQ loop\n' +
'LOAD R0 0           ; Line 6 — Accumulator\n' +
'LOAD R6 3           ; Line 7 — Loop counter\n' +
'LOAD R7 1           ; Line 8 — Decrement constant\n' +
'\n' +
'; Loop start = Line 9\n' +
'ADD R0 R0 R5        ; Line 9  — Accumulate\n' +
'SUB R6 R6 R7        ; Line 10 — Decrement counter\n' +
'LOAD R2 0           ; Line 11 — Zero for comparison\n' +
'BEQ R6 R2 14        ; Line 12 — If counter=0, jump to HALT\n' +
'JUMP 9              ; Line 13 — Else loop back\n' +
'\n' +
'HALT                ; Line 14 — R0 should be 53.25';
    clearConsole();
    log('Challenge loaded! Click Execute to run.', 'info');
    log('   Expected result: R0 = 53.25', 'info');
}

// Initialize UI on page load
window.onload = function() { updateUI(); };

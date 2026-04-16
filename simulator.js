// 1. Hardware State
let cpu = {
    registers: [0, 0, 0, 0], // R0, R1, R2, R3
    pc: 0                    // Program Counter
};

function runProgram() {
    const code = document.getElementById('code').value.split('\n');
    cpu.pc = 0;
    cpu.registers = [0, 0, 0, 0]; // Reset hardware

    while (cpu.pc < code.length) {
        let rawLine = code[cpu.pc].trim();
        if (rawLine === "") { cpu.pc++; continue; }

        // FETCH & DECODE
        let parts = rawLine.split(' ');
        let instruction = parts[0]; // e.g., "ADD"

        // EXECUTE
        execute(instruction, parts.slice(1));

        cpu.pc++; // Increment Program Counter
    }
    updateUI();
}

function execute(instr, args) {
    switch(instr) {
        case "LOAD": 
            // args[0] is register name (e.g., "R1"), args[1] is value
            let regIdx = parseInt(args[0].replace('R', ''));
            cpu.registers[regIdx] = parseInt(args[1]);
            break;

        case "ADD":
            // Syntax: ADD Dest Source1 Source2 (e.g., ADD R3 R1 R2)
            let dest = parseInt(args[0].replace('R', ''));
            let s1 = parseInt(args[1].replace('R', ''));
            let s2 = parseInt(args[2].replace('R', ''));
            cpu.registers[dest] = cpu.registers[s1] + cpu.registers[s2];
            break;

        case "MUL":
    // Syntax: MUL Dest Source1 Source2 (e.g., MUL R3 R1 R2)
        let destMul = parseInt(args[0].replace('R', ''));
        let s1Mul = parseInt(args[1].replace('R', ''));
        let s2Mul = parseInt(args[2].replace('R', ''));
        cpu.registers[destMul] = cpu.registers[s1Mul] * cpu.registers[s2Mul];
    break;

        default:
            console.log("Unknown Instruction: " + instr);
    }
}

function updateUI() {
    document.getElementById('registers').innerText = `Registers: [${cpu.registers.join(', ')}]`;
    document.getElementById('pc').innerText = `PC: ${cpu.pc}`;
    document.getElementById('console').innerHTML += `Program Finished. Result: ${cpu.registers.join(' | ')} <br>`;
}
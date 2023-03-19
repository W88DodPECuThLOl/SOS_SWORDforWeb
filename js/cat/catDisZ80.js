export class CatDisZ80 {
    #r1_regs = [
        `<span class="css-tooltip" data-tooltip="{regB}">B</span>`,
        `<span class="css-tooltip" data-tooltip="{regC}">C</span>`,
        `<span class="css-tooltip" data-tooltip="{regD}">D</span>`,
        `<span class="css-tooltip" data-tooltip="{regE}">E</span>`,
        `<span class="css-tooltip" data-tooltip="{regH}">H</span>`,
        `<span class="css-tooltip" data-tooltip="{regL}">L</span>`,
        `<span class="css-tooltip" data-tooltip="{regHL}">(<HL>)</span>`,
        `<span class="css-tooltip" data-tooltip="{regA}">A</span>`
    ];
    #r2_regs = ["<B>", "<C>", "<D>", "<E>", "<H>", "<L>", "(<HL>)", "<A>"];
    #table1 = [
        { size:1, mask: 0xFF, pat: 0x00, cmd: "NOP", op: "" },
        { size:1, mask: 0xFF, pat: 0x76, cmd: "HALT", op: "" },
        { size:1, mask: 0xFF, pat: 0xF3, cmd: "DI", op: "" },
        { size:1, mask: 0xFF, pat: 0xFB, cmd: "EI", op: "" },
        // 01DDDSSS LD r1, r2
        // 01DDD110 LD r1, (HL)
        // 01110SSS LD (HL), r2
        { size:1, mask: 0xC0, pat: 0x40, cmd: "LD", op: "{r1},{r2}" },
        // 00DDD110 LD r1, n
        // 00110110 LD (HL), n
        { size:2, mask: 0xC7, pat: 0x06, cmd: "LD", op: "{r1}, {imm8}" },

        // 00001010 LD A,(BC)
        { size:1, mask: 0xFF, pat: 0x0A, cmd: "LD", op: "{A}, ({mem16_BC})" },
        // 00011010 LD A,(DE)
        { size:1, mask: 0xFF, pat: 0x1A, cmd: "LD", op: "{A}, ({mem16_DE})" },
        // 00111010 LD A,(nnmm)
        { size:3, mask: 0xFF, pat: 0x3A, cmd: "LD", op: "{A}, ({mem16})" },

        // 00000010 LD (BC), A
        { size:1, mask: 0xFF, pat: 0x02, cmd: "LD", op: "(<mem16_BC>), <A>" },
        // 00010010 LD (DE), A
        { size:1, mask: 0xFF, pat: 0x12, cmd: "LD", op: "(<mem16_DE>), <A>" },
        // 00110010 LD (nnmm), A
        { size:3, mask: 0xFF, pat: 0x32, cmd: "LD", op: "(<mem16>), <A>" },
    ];
    #tableDD = [
        // 1101 1101
        // 0111 0110
        { size:2, mask: 0xFF, pat: 0x76, cmd: "??", op: "" }, // 未定義命令
        // 1101 1101
        // 01DD D110
        // byte 3:d
    ];
    #tableED = [
        { size:2, mask: 0xFF, pat: 0x46, cmd: "IM 0", op: "" },
        { size:2, mask: 0xFF, pat: 0x56, cmd: "IM 1", op: "" },
        { size:2, mask: 0xFF, pat: 0x5E, cmd: "IM 2", op: "" },
    ];

    constructor()
    {
    }

    /**
     * 
     * @param {number} address  
     * @param {mem[]} 
     */
    getText(address, mem, beforeZ80Info, afterZ80Info)
    {
        let cmdText = "??";
        let opText = "";
        let cmdSize = 1;
        const mem0 = mem[0];
        const mem1 = mem[1];
        const mem2 = mem[2];
        const mem3 = mem[3];
        // テーブル検索
        let code0 = mem0;
        let code1 = mem1;
        let code2 = mem2;
        let code3 = mem3;
        let tbl = this.#table1;
        switch(mem0) {
            case 0xDD:
                tbl = this.#tableDD;
                code0 = mem1;
                code1 = mem2;
                code2 = mem3;
                break;
            case 0xED:
                tbl = this.#tableED;
                code0 = mem1;
                code1 = mem2;
                code2 = mem3;
                break;
        }
        for(const info of tbl) {
            if((info.mask & mem0) != info.pat) { continue; }
            cmdText = info.cmd;
            opText = info.op;
            cmdSize = info.size;

            // 置換
            opText = opText.replace("{r1}", this.#r1_regs[(code0 >> 3) & 7]);
            opText = opText.replace("{r2}", this.#r2_regs[code0 & 7]);
            opText = opText.replace("{imm8}", "$" + code1.toString(16).padStart(2, 0).toUpperCase());
            opText = opText.replace("{mem16_BC}", "BC");
            opText = opText.replace("{mem16_DE}", "DE");
            opText = opText.replace("{mem16}", "$" + (code1 | (code2 << 8)) .toString(16).padStart(4, 0).toUpperCase());
            break;
        }
        return {
            cmd: cmdText,
            op: opText,
            size: cmdSize
        };
    }
}

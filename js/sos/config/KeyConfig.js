var jsFrame = null;

const KeyNameToKeyCode = new Map([
	["---", -1],
	["BackSpace", 8],
	["Tab", 9],
	["Enter", 13],
	["Shift", 16],
	["Ctrl", 17],
	["Alt", 18],
	["PauseBreak", 19],
	["CapsLock", 20],
	["Esc", 27],
	["Space", 32],
	["PageUp", 33],
	["PageDown", 34],
	["End", 35],
	["Home", 36],
	["←", 37],
	["↑", 38],
	["→", 39],
	["↓", 40],
	["Insert", 45],
	["Delete", 46],
	["NumLock", 144],
	["ScrollLock", 145],
	[": *", 186],
	["; +", 187],
	[", <", 188],
	["- =", 189],
	[". >", 190],
	["/ ?", 191],
	["@ `", 192],
	["[ {", 219],
	["\\ |", 220],
	["] }", 221],
	["^ ~", 222],
	["\\ _", 226],

	["a A", 65],
	["b B", 66],
	["c C", 67],
	["d D", 68],
	["e E", 69],
	["f F", 70],
	["g G", 71],
	["h H", 72],
	["i I", 73],
	["j J", 74],
	["k K", 75],
	["l L", 76],
	["m M", 77],
	["n N", 78],
	["o O", 79],
	["p P", 80],
	["q Q", 81],
	["r R", 82],
	["s S", 83],
	["t T", 84],
	["u U", 85],
	["v V", 86],
	["w W", 87],
	["x X", 88],
	["y Y", 89],
	["z Z", 90],

	["0", 48],
	["1", 49],
	["2", 50],
	["3", 51],
	["4", 52],
	["5", 53],
	["6", 54],
	["7", 55],
	["8", 56],
	["9", 57],

	["Num0", 96],
	["Num1", 97],
	["Num2", 98],
	["Num3", 99],
	["Num4", 100],
	["Num5", 101],
	["Num6", 102],
	["Num7", 103],
	["Num8", 104],
	["Num9", 105],
	["Num*", 106],
	["Num+", 107],
	["Num-", 109],
	["Num.", 110],
	["Num/", 111],

	["F1", 112],
	["F2", 113],
	["F3", 114],
	["F4", 115],
	["F5", 116],
	["F6", 117],
	["F7", 118],
	["F8", 119],
	["F9", 120],
	["F10", 121],
	["F11", 122],
	["F12", 123]
]);

const DefaultkeyConfig = {
	items:[
		{sos_code: 0x00, sos_code_name: "nul", assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "@ `" }]},
		{sos_code: 0x01, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "a A" }]},
		{sos_code: 0x02, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "b B" }]},
		{sos_code: 0x03, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "c C" }]},
		{sos_code: 0x04, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "d D" }]},
		{sos_code: 0x05, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "e E" }]},
		{sos_code: 0x06, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "f F" }]},
		{sos_code: 0x07, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "g G" }]},
		{sos_code: 0x08, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "h H" }]},
		{sos_code: 0x09, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "i I" }]},
		{sos_code: 0x0A, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "j J" }]},
		{sos_code: 0x0B, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "k K" }]},
		{sos_code: 0x0C, sos_code_name: "CLS", assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "l L" }]},
		{sos_code: 0x0D, sos_code_name: "CR",  assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "m M" }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Enter" }]},
		{sos_code: 0x0E, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "n N" }]},
		{sos_code: 0x0F, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "o O" }]},

		{sos_code: 0x10, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "p P" }]},
		{sos_code: 0x11, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "q Q" }]},
		{sos_code: 0x12, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "r R" }]},
		{sos_code: 0x13, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "s S" }]},
		{sos_code: 0x14, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "t T" }]},
		{sos_code: 0x15, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "u U" }]},
		{sos_code: 0x16, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "v V" }]},
		{sos_code: 0x17, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "w W" }]},
		{sos_code: 0x18, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "x X" }]},
		{sos_code: 0x19, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "y Y" }]},
		{sos_code: 0x1A, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "z Z" }]},
		{sos_code: 0x1B, sos_code_name: "BRK", assignments: [
			{ shift: false, capslock: false, ctrl: true,  alt: false, key: "[ {" },
			{ shift: false, capslock: false, ctrl: false, alt: false, key: "Esc" },
			{ shift: false, capslock: false, ctrl: false, alt: false, key: "PauseBreak" }
		]},
		{sos_code: 0x1C, sos_code_name: "→",   assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "\\ |" }]},
		{sos_code: 0x1D, sos_code_name: "←",   assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "] }" }]},
		{sos_code: 0x1E, sos_code_name: "↑",   assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "^ ~" }]},
		{sos_code: 0x1F, sos_code_name: "↓",   assignments: [{ shift: false, capslock: false, ctrl: true,  alt: false, key: "\\ _" }]},

		{sos_code: 0x20, sos_code_name: " ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "Space" }]},
		{sos_code: 0x21, sos_code_name: "!",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "1"   }]},
		{sos_code: 0x22, sos_code_name: "\"",  assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "2"   }]},
		{sos_code: 0x23, sos_code_name: "#",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "3"   }]},
		{sos_code: 0x24, sos_code_name: "$",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "4"   }]},
		{sos_code: 0x25, sos_code_name: "%",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "5"   }]},
		{sos_code: 0x26, sos_code_name: "&",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "6"   }]},
		{sos_code: 0x27, sos_code_name: "'",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "7"   }]},
		{sos_code: 0x28, sos_code_name: "(",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "8"   }]},
		{sos_code: 0x29, sos_code_name: ")",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "9"   }]},
		{sos_code: 0x2A, sos_code_name: "*",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: ": *" }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num*" }]},
		{sos_code: 0x2B, sos_code_name: "+",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "; +" }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num+" }]},
		{sos_code: 0x2C, sos_code_name: ",",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: ", <" }]},
		{sos_code: 0x2D, sos_code_name: "-",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "- =" }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num-" }]},
		{sos_code: 0x2E, sos_code_name: ".",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: ". >" }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num." }]},
		{sos_code: 0x2F, sos_code_name: "/",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "/ ?" }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num/" }]},

		{sos_code: 0x30, sos_code_name: "0",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "0"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num0" }]},
		{sos_code: 0x31, sos_code_name: "1",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "1"   },	{ shift: false, capslock: false, ctrl: false, alt: false, key: "Num1" }]},
		{sos_code: 0x32, sos_code_name: "2",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "2"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num2" }]},
		{sos_code: 0x33, sos_code_name: "3",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "3"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num3" }]},
		{sos_code: 0x34, sos_code_name: "4",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "4"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num4" }]},
		{sos_code: 0x35, sos_code_name: "5",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "5"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num5" }]},
		{sos_code: 0x36, sos_code_name: "6",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "6"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num6" }]},
		{sos_code: 0x37, sos_code_name: "7",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "7"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num7" }]},
		{sos_code: 0x38, sos_code_name: "8",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "8"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num8" }]},
		{sos_code: 0x39, sos_code_name: "9",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "9"   }, { shift: false, capslock: false, ctrl: false, alt: false, key: "Num9" }]},
		{sos_code: 0x3A, sos_code_name: ":",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: ": *" }]},
		{sos_code: 0x3B, sos_code_name: ";",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "; +" }]},
		{sos_code: 0x3C, sos_code_name: "<",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: ", <" }]},
		{sos_code: 0x3D, sos_code_name: "=",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "- =" }]},
		{sos_code: 0x3E, sos_code_name: ">",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: ". >" }]},
		{sos_code: 0x3F, sos_code_name: "?",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "/ ?" }]},

		{sos_code: 0x40, sos_code_name: "@",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "@ `" }]},
		{sos_code: 0x41, sos_code_name: "A",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "a A" }]},
		{sos_code: 0x42, sos_code_name: "B",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "b B" }]},
		{sos_code: 0x43, sos_code_name: "C",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "c C" }]},
		{sos_code: 0x44, sos_code_name: "D",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "d D" }]},
		{sos_code: 0x45, sos_code_name: "E",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "e E" }]},
		{sos_code: 0x46, sos_code_name: "F",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "f F" }]},
		{sos_code: 0x47, sos_code_name: "G",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "g G" }]},
		{sos_code: 0x48, sos_code_name: "H",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "h H" }]},
		{sos_code: 0x49, sos_code_name: "I",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "i I" }]},
		{sos_code: 0x4A, sos_code_name: "J",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "j J" }]},
		{sos_code: 0x4B, sos_code_name: "K",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "k K" }]},
		{sos_code: 0x4C, sos_code_name: "L",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "l L" }]},
		{sos_code: 0x4D, sos_code_name: "M",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "m M" }]},
		{sos_code: 0x4E, sos_code_name: "N",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "n N" }]},
		{sos_code: 0x4F, sos_code_name: "O",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "o O" }]},

		{sos_code: 0x50, sos_code_name: "P",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "p P" }]},
		{sos_code: 0x51, sos_code_name: "Q",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "q Q" }]},
		{sos_code: 0x52, sos_code_name: "R",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "r R" }]},
		{sos_code: 0x53, sos_code_name: "S",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "s S" }]},
		{sos_code: 0x54, sos_code_name: "T",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "t T" }]},
		{sos_code: 0x55, sos_code_name: "U",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "u U" }]},
		{sos_code: 0x56, sos_code_name: "V",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "v V" }]},
		{sos_code: 0x57, sos_code_name: "W",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "w W" }]},
		{sos_code: 0x58, sos_code_name: "X",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "x X" }]},
		{sos_code: 0x59, sos_code_name: "Y",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "y Y" }]},
		{sos_code: 0x5A, sos_code_name: "Z",   assignments: [{ shift: true,  capslock: true,  ctrl: false, alt: false, key: "z Z" }]},
		{sos_code: 0x5B, sos_code_name: "[",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "[ {" }]},
		{sos_code: 0x5C, sos_code_name: "\\",   assignments: [
			{ shift: false, capslock: false, ctrl: false, alt: false, key: "\\ |" },
			{ shift: false, capslock: false, ctrl: false, alt: false, key: "\\ _" }
		]},
		{sos_code: 0x5D, sos_code_name: "]",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "] }" }]},
		{sos_code: 0x5E, sos_code_name: "^",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "^ ~" }]},
		{sos_code: 0x5F, sos_code_name: "_",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "\\ _" }]},

		{sos_code: 0x60, sos_code_name: "`",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "@ `" }]},
		{sos_code: 0x61, sos_code_name: "a",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "a A" }]},
		{sos_code: 0x62, sos_code_name: "b",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "b B" }]},
		{sos_code: 0x63, sos_code_name: "c",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "c C" }]},
		{sos_code: 0x64, sos_code_name: "d",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "d D" }]},
		{sos_code: 0x65, sos_code_name: "e",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "e E" }]},
		{sos_code: 0x66, sos_code_name: "f",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "f F" }]},
		{sos_code: 0x67, sos_code_name: "g",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "g G" }]},
		{sos_code: 0x68, sos_code_name: "h",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "h H" }]},
		{sos_code: 0x69, sos_code_name: "i",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "i I" }]},
		{sos_code: 0x6A, sos_code_name: "j",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "j J" }]},
		{sos_code: 0x6B, sos_code_name: "k",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "k K" }]},
		{sos_code: 0x6C, sos_code_name: "l",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "l L" }]},
		{sos_code: 0x6D, sos_code_name: "m",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "m M" }]},
		{sos_code: 0x6E, sos_code_name: "n",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "n N" }]},
		{sos_code: 0x6F, sos_code_name: "o",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "o O" }]},

		{sos_code: 0x70, sos_code_name: "p",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "p P" }]},
		{sos_code: 0x71, sos_code_name: "q",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "q Q" }]},
		{sos_code: 0x72, sos_code_name: "r",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "r R" }]},
		{sos_code: 0x73, sos_code_name: "s",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "s S" }]},
		{sos_code: 0x74, sos_code_name: "t",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "t T" }]},
		{sos_code: 0x75, sos_code_name: "u",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "u U" }]},
		{sos_code: 0x76, sos_code_name: "v",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "v V" }]},
		{sos_code: 0x77, sos_code_name: "w",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "w W" }]},
		{sos_code: 0x78, sos_code_name: "x",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "x X" }]},
		{sos_code: 0x79, sos_code_name: "y",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "y Y" }]},
		{sos_code: 0x7A, sos_code_name: "z",   assignments: [{ shift: false, capslock: true,  ctrl: false, alt: false, key: "z Z" }]},
		{sos_code: 0x7B, sos_code_name: "{",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "[ {" }]},
		{sos_code: 0x7C, sos_code_name: "|",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "\\ |" }]},
		{sos_code: 0x7D, sos_code_name: "}",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "] }" }]},
		{sos_code: 0x7E, sos_code_name: "~",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: false, key: "^ ~" }]},
		{sos_code: 0x7F, sos_code_name: "π",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},

		{sos_code: 0x80, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x81, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x82, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x83, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x84, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x85, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x86, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x87, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x88, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x89, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x8A, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x8B, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x8C, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x8D, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x8E, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x8F, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},

		{sos_code: 0x90, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x91, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x92, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x93, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x94, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x95, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x96, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x97, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x98, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x99, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x9A, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x9B, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x9C, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x9D, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x9E, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0x9F, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},

		{sos_code: 0xA0, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "Space" }]},
		{sos_code: 0xA1, sos_code_name: "｡",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: ". >" }]},
		{sos_code: 0xA2, sos_code_name: "｢",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "[ {" }]},
		{sos_code: 0xA3, sos_code_name: "｣",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "] }" }]},
		{sos_code: 0xA4, sos_code_name: "､",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: ", <" }]},
		{sos_code: 0xA5, sos_code_name: "･",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "/ ?" }]},
		{sos_code: 0xA6, sos_code_name: "ｦ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "0"   }]},
		{sos_code: 0xA7, sos_code_name: "ｧ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "3"   }]},
		{sos_code: 0xA8, sos_code_name: "ｨ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "e E" }]},
		{sos_code: 0xA9, sos_code_name: "ｩ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "4"   }]},
		{sos_code: 0xAA, sos_code_name: "ｪ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "5"   }]},
		{sos_code: 0xAB, sos_code_name: "ｫ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "6"   }]},
		{sos_code: 0xAC, sos_code_name: "ｬ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "7"   }]},
		{sos_code: 0xAD, sos_code_name: "ｭ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "8"   }]},
		{sos_code: 0xAE, sos_code_name: "ｮ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "9"   }]},
		{sos_code: 0xAF, sos_code_name: "ｯ",   assignments: [{ shift: true,  capslock: false, ctrl: false, alt: true,  key: "z Z" }]},

		{sos_code: 0xB0, sos_code_name: "ｰ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "\\ |" }]},
		{sos_code: 0xB1, sos_code_name: "ｱ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "3"   }]},
		{sos_code: 0xB2, sos_code_name: "ｲ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "e E" }]},
		{sos_code: 0xB3, sos_code_name: "ｳ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "4"   }]},
		{sos_code: 0xB4, sos_code_name: "ｴ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "5"   }]},
		{sos_code: 0xB5, sos_code_name: "ｵ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "6"   }]},
		{sos_code: 0xB6, sos_code_name: "ｶ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "t T" }]},
		{sos_code: 0xB7, sos_code_name: "ｷ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "g G" }]},
		{sos_code: 0xB8, sos_code_name: "ｸ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "h H" }]},
		{sos_code: 0xB9, sos_code_name: "ｹ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: ": *" }]},
		{sos_code: 0xBA, sos_code_name: "ｺ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "b B" }]},
		{sos_code: 0xBB, sos_code_name: "ｻ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "x X" }]},
		{sos_code: 0xBC, sos_code_name: "ｼ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "d D" }]},
		{sos_code: 0xBD, sos_code_name: "ｽ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "r R" }]},
		{sos_code: 0xBE, sos_code_name: "ｾ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "p P" }]},
		{sos_code: 0xBF, sos_code_name: "ｿ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "c C" }]},

		{sos_code: 0xC0, sos_code_name: "ﾀ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "q Q" }]},
		{sos_code: 0xC1, sos_code_name: "ﾁ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "a A" }]},
		{sos_code: 0xC2, sos_code_name: "ﾂ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "z Z" }]},
		{sos_code: 0xC3, sos_code_name: "ﾃ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "w W" }]},
		{sos_code: 0xC4, sos_code_name: "ﾄ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "s S" }]},
		{sos_code: 0xC5, sos_code_name: "ﾅ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "u U" }]},
		{sos_code: 0xC6, sos_code_name: "ﾆ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "i I" }]},
		{sos_code: 0xC7, sos_code_name: "ﾇ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "1"   }]},
		{sos_code: 0xC8, sos_code_name: "ﾈ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: ", <" }]},
		{sos_code: 0xC9, sos_code_name: "ﾉ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "k K" }]},
		{sos_code: 0xCA, sos_code_name: "ﾊ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "f F" }]},
		{sos_code: 0xCB, sos_code_name: "ﾋ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "v V" }]},
		{sos_code: 0xCC, sos_code_name: "ﾌ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "2"   }]},
		{sos_code: 0xCD, sos_code_name: "ﾍ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "^ ~" }]},
		{sos_code: 0xCE, sos_code_name: "ﾎ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "- =" }]},
		{sos_code: 0xCF, sos_code_name: "ﾏ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "j J" }]},

		{sos_code: 0xD0, sos_code_name: "ﾐ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "n N" }]},
		{sos_code: 0xD1, sos_code_name: "ﾑ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "] }" }]},
		{sos_code: 0xD2, sos_code_name: "ﾒ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "/ ?" }]},
		{sos_code: 0xD3, sos_code_name: "ﾓ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "m M" }]},
		{sos_code: 0xD4, sos_code_name: "ﾔ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "7"   }]},
		{sos_code: 0xD5, sos_code_name: "ﾕ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "8"   }]},
		{sos_code: 0xD6, sos_code_name: "ﾖ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "9"   }]},
		{sos_code: 0xD7, sos_code_name: "ﾗ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "o O" }]},
		{sos_code: 0xD8, sos_code_name: "ﾘ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "l L" }]},
		{sos_code: 0xD9, sos_code_name: "ﾙ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: ". >" }]},
		{sos_code: 0xDA, sos_code_name: "ﾚ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "; +" }]},
		{sos_code: 0xDB, sos_code_name: "ﾛ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "\\ _" }]},
		{sos_code: 0xDC, sos_code_name: "ﾜ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "0"   }]},
		{sos_code: 0xDD, sos_code_name: "ﾝ",   assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "y Y" }]},
		{sos_code: 0xDE, sos_code_name: "゛",  assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "@ `" }]},
		{sos_code: 0xDF, sos_code_name: "゜",  assignments: [{ shift: false, capslock: false, ctrl: false, alt: true,  key: "[ {" }]},

		{sos_code: 0xE0, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE1, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE2, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE3, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE4, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE5, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE6, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE7, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE8, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xE9, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xEA, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xEB, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xEC, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xED, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xEE, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xEF, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},

		{sos_code: 0xF0, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF1, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF2, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF3, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF4, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF5, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF6, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF7, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF8, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xF9, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xFA, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xFB, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xFC, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xFD, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xFE, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},
		{sos_code: 0xFF, sos_code_name: "",    assignments: [{ shift: false, capslock: false, ctrl: false, alt: false, key: "---" }]},

		// editor
		// カーソル位置の文字を１文字削除し、１文字詰める
		{sos_code: 0xFFFF, sos_code_name: "Delete", express: "カーソル位置の文字を削除", assignments: [{ shift: false, ctrl: false, alt: false, key: "Delete" }]},
		// カーソル位置の１つ前の文字を削除し、１文字詰める
		{sos_code: 0xFFFF, sos_code_name: "BackSpace", express: "カーソル位置の前の文字を削除", assignments: [{ shift: false, ctrl: false, alt: false, key: "BackSpace" }]},
		// 行頭へカーソルを移動する
		{sos_code: 0xFFFF, sos_code_name: "Home", express: "行頭へカーソルを移動", assignments: [{ shift: false, ctrl: false, alt: false, key: "Home" }]},
		// 行末へカーソルを移動する
		{sos_code: 0xFFFF, sos_code_name: "End", express: "行末へカーソルを移動", assignments: [{ shift: false, ctrl: false, alt: false, key: "End" }]},
		// カーソル位置を１文字分右へ移動する
		{sos_code: 0xFFFF, sos_code_name: "ArrowRight", express: "カーソルを右へ移動", assignments: [{ shift: false, ctrl: false, alt: false, key: "→" }]},
		// カーソル位置を１文字分左へ移動する
		{sos_code: 0xFFFF, sos_code_name: "ArrowLeft", express: "カーソルを左へ移動", assignments: [{ shift: false, ctrl: false, alt: false, key: "←" }]},
		// カーソル位置を１文字分上へ移動する
		{sos_code: 0xFFFF, sos_code_name: "ArrowUp", express: "カーソルを上へ移動", assignments: [{ shift: false, ctrl: false, alt: false, key: "↑" }]},
		// カーソル位置を１文字分下へ移動する
		{sos_code: 0xFFFF, sos_code_name: "ArrowDown", express: "カーソルを下へ移動", assignments: [{ shift: false, ctrl: false, alt: false, key: "↓" }]},
		{sos_code: 0xFFFF, sos_code_name: "EraseToLineEnd",  express: "行末まで削除", assignments: [{ shift: true, ctrl: true, alt: false, key: "e E" }]},
		{sos_code: 0xFFFF, sos_code_name: "EraseToScreenEnd",  express: "画面最後まで削除", assignments: [{ shift: true, ctrl: true, alt: false, key: "z Z" }]},
		// Fキー
		{sos_code: 0xFFFF, sos_code_name: "F1",  express: "F1", assignments: [{ shift: false, ctrl: false, alt: false, key: "F1" }]},
		{sos_code: 0xFFFF, sos_code_name: "F2",  express: "F2", assignments: [{ shift: false, ctrl: false, alt: false, key: "F2" }]},
		{sos_code: 0xFFFF, sos_code_name: "F3",  express: "F3", assignments: [{ shift: false, ctrl: false, alt: false, key: "F3" }]},
		{sos_code: 0xFFFF, sos_code_name: "F4",  express: "F4", assignments: [{ shift: false, ctrl: false, alt: false, key: "F4" }]},
		{sos_code: 0xFFFF, sos_code_name: "F5",  express: "F5", assignments: [{ shift: false, ctrl: false, alt: false, key: "F5" }]},
		{sos_code: 0xFFFF, sos_code_name: "F6",  express: "F6", assignments: [{ shift: false, ctrl: false, alt: false, key: "F6" }]},
		{sos_code: 0xFFFF, sos_code_name: "F7",  express: "F7", assignments: [{ shift: false, ctrl: false, alt: false, key: "F7" }]},
		{sos_code: 0xFFFF, sos_code_name: "F8",  express: "F8", assignments: [{ shift: false, ctrl: false, alt: false, key: "F8" }]},
		{sos_code: 0xFFFF, sos_code_name: "F9",  express: "F9", assignments: [{ shift: false, ctrl: false, alt: false, key: "F9" }]},
		{sos_code: 0xFFFF, sos_code_name: "F10", express: "F10", assignments: [{ shift: false, ctrl: false, alt: false, key: "F10" }]},
	]
};

var keyCfg = {items: DefaultkeyConfig.items.map(e => ({...e})) };

function sosKeyConverter(e)
{
//	const keyCfg = DefaultkeyConfig;
	let shiftKey = !!e.shiftKey;
	const ctrlKey = !!e.ctrlKey;
	const altKey = !!e.altKey;
	const capsLock = e.getModifierState("CapsLock") ? true : false;
	//console.log("keyCode:" + e.keyCode + " shift:" + shiftKey + " ctrl:" + ctrlKey + " Alt:" + altKey);
	for(let sosKey of keyCfg.items) {
		for(let a of sosKey.assignments) {
			if(a.capslock && capsLock) {
				// キャプスロックの影響を受ける
				shiftKey = !shiftKey;
			}
			if(a.shift == shiftKey && a.alt == altKey && a.ctrl == ctrlKey && KeyNameToKeyCode.has(a.key) && e.keyCode == KeyNameToKeyCode.get(a.key)) {
				if(sosKey.sos_code == 0xFFFF) {
					return sosKey.sos_code_name; // 編集用のコード
				} else {
					return sosKey.sos_code;
				}
			}
		}
	}
	return 0;
}

function onChangeKeyCfgKeyCode(itemIndex, index, keyCode)
{
//	const keyCfg = DefaultkeyConfig;
	for(let [keyName, kc] of KeyNameToKeyCode) {
		if(kc == keyCode) {
			keyCfg.items[itemIndex].assignments[index].key = keyName;
			return;
		}
	}
}

function onChangeKeyCfgShift(itemIndex, index, checked)
{
//	const keyCfg = DefaultkeyConfig;
	keyCfg.items[itemIndex].assignments[index].shift = checked;
}

function onChangeKeyCfgCapsLock(itemIndex, index, checked)
{
//	const keyCfg = DefaultkeyConfig;
	keyCfg.items[itemIndex].assignments[index].capslock = checked;
}

function onChangeKeyCfgCtrl(itemIndex, index, checked)
{
//	const keyCfg = DefaultkeyConfig;
	keyCfg.items[itemIndex].assignments[index].ctrl = checked;
}

function onChangeKeyCfgAlt(itemIndex, index, checked)
{
//	const keyCfg = DefaultkeyConfig;
	keyCfg.items[itemIndex].assignments[index].alt = checked;
}

function keyConfigLoad(evt)
{
	let input = evt;
	if (input.files.length == 0) {
		return;
	}
	const file = input.files[0];
	const reader = new FileReader();
	reader.onload = () => {
		keyCfg = JSON.parse(reader.result);

		let frame = jsFrame.getWindowByName('S-OS_KeyConfig-Window');
		if(frame) {
			frame.setHTML(generateKeyConfigHTML());
			return;
		}
	
	};
	reader.readAsText(file);
}

function keyConfigSave()
{
	const text = JSON.stringify(keyCfg);
	{
		const blob = new Blob([text], {type: 'text/plain'}); // Blob オブジェクトの作成
		const link = document.createElement('a');
		link.download = 'sosKeyCfg.json'; // ダウンロードファイル名称
		link.href = window.URL.createObjectURL(blob); // オブジェクト URL を生成
		link.click(); // クリックイベントを発生させる
		window.URL.revokeObjectURL(link.href); // オブジェクト URL を解放」
	}
}

function generateKeyConfigHTML()
{
	let items = "";
//	const keyCfg = DefaultkeyConfig;
	let itemIndex = 0;
	for(let e of keyCfg.items) {
		let sos_code = (e.sos_code != 0xFFFF) ? ("0x" + e.sos_code.toString(16).padStart(2, "0").toUpperCase()) : "編集用";
		let sos_code_name = e.sos_code_name + (e.express ? ("<br>" + e.express) : "");
		let index = 0;
		for(let a of e.assignments) {
			const shift = a.shift ? "checked" : "";
			let control = a.ctrl ? "checked" : "";
			let alt   = a.alt ? "checked" : "";
			let CapsLock = a.capslock ? "checked" : "";

			let optionText = `<select onchange="onChangeKeyCfgKeyCode(${itemIndex}, ${index}, this.value)">`;
			for(let [keyName, keyCode] of KeyNameToKeyCode) {
				let selected = (keyName == a.key) ? "selected" : "";
				optionText += `<option value=${keyCode} ${selected}>${keyName}</option>`;
			}
			optionText += "</select>";
			items += `<tr><td>${sos_code}</td><td>${sos_code_name}</td><td>${optionText}<input type="checkbox" onchange="onChangeKeyCfgShift(${itemIndex}, ${index}, this.checked)" ${shift}>SHIFT <input type="checkbox" onchange="onChangeKeyCfgCapsLock(${itemIndex}, ${index}, this.checked)" ${CapsLock}>CapsLock    <input type="checkbox" onchange="onChangeKeyCfgCtrl(${itemIndex}, ${index}, this.checked)" ${control}>CONTROL <input type="checkbox" onchange="onChangeKeyCfgAlt(${itemIndex}, ${index}, this.checked)" ${alt}>Alt</td></tr>`;
			index++;
		}
		itemIndex++;
	}
	return `<div id="my_element" style="padding:3px;font-size:10px;color:darkgray;">
		<div class="box">
			<table class="content-table">
				<thead><tr>
					<th>S-OS<br>ASCII</th>
					<th>名前</th>
					<th>割り当てるキー</th>
				</tr></thead>
				<tbody>${items}</tbody>
			</table>
		</div>
	</div>
	<input type='file' value='読み込み...' accept=".json" onchange="keyConfigLoad(this);">
	<input type='button' value='保存...' onClick="keyConfigSave();">
	`;
}

function ShowKeyConfigWindow()
{
	if(!jsFrame) {
		jsFrame = new JSFrame();
	}
	let frame = jsFrame.getWindowByName('S-OS_KeyConfig-Window');
	if(frame) {
		frame.show();
		frame.requestFocus();
		return;
	}

	frame = jsFrame.create({
		title: 'キーコンフィグ',
		name: 'S-OS_KeyConfig-Window',
		left: 20, top: 20, width: 600, height: 350,
		minWidth: 350, minHeight: 350,
		movable: true,//マウスで移動可能かどうか
		resizable: true,//マウスでリサイズ可能かどうか
		html: generateKeyConfigHTML()
	});
	//ウィンドウを表示する
	//frame.showModal();
	frame.show();
}

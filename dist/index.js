"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const ws_1 = __importStar(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const wss = new ws_1.Server({ port: 8080 });
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.post('/lock-all-teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.team.updateMany({
            data: { locked: true }
        });
        res.status(200).json({ message: 'All teams locked successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/unlock-all-teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.team.updateMany({
            data: { locked: false }
        });
        res.status(200).json({ message: 'All teams unlocked successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/register-team', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { team_name, team_password, users } = req.body;
    try {
        const existingTeam = yield prisma.team.findUnique({
            where: { team_name },
        });
        if (existingTeam) {
            return res.status(400).json({ error: 'Team name already exists' });
        }
        const newTeam = yield prisma.team.create({
            data: {
                team_name,
                team_password,
                users: {
                    create: users.map(user => ({
                        EnrollNo: user.EnrollNo,
                        name: user.name,
                    }))
                }
            },
            include: {
                users: true
            }
        });
        res.status(201).json(newTeam);
    }
    catch (error) {
        res.status(400).json({ error: 'User in another team' });
    }
}));
app.post('/add-question', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { question_text, question_description, answer } = req.body;
    try {
        const question = yield prisma.question.create({
            data: {
                question_id: crypto_1.default.randomUUID(),
                question_text,
                question_description,
                answer
            }
        });
        res.status(201).json(question);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
}));
app.post('/login-team', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { team_name, team_password } = req.body;
    try {
        const team = yield prisma.team.findUnique({
            where: { team_name },
            select: {
                team_name: true,
                team_password: true
            }
        });
        if (!team) {
            return res.status(401).json({ error: 'Invalid team name or password' });
        }
        const validPassword = team.team_password === team_password;
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid team name or password' });
        }
        res.status(200).json({ message: 'Login successful', team_name: team.team_name });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/submit-answer', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { team_name, question_id, answer } = req.body;
    try {
        const team = yield prisma.team.findUnique({ where: { team_name } });
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        const teamProgress = yield prisma.teamProgress.findFirst({
            where: { team_name, question_id },
            include: { question: true }
        });
        if (teamProgress) {
            if (teamProgress.is_completed) {
                return res.status(400).json({ message: 'This team has already submitted the correct answer for this question.' });
            }
            if (teamProgress.question.answer.toLowerCase() === answer.toLowerCase()) {
                yield prisma.teamProgress.update({
                    where: { progress_id: teamProgress.progress_id },
                    data: { is_completed: true, solved_at: new Date() }
                });
                return res.status(200).json({ message: 'Correct answer! Question marked as completed.' });
            }
            return res.status(400).json({ message: 'Incorrect answer.' });
        }
        const question = yield prisma.question.findUnique({ where: { question_id } });
        if (!question) {
            return res.status(404).json({ message: 'Question not found.' });
        }
        if (question.answer.toLowerCase() === answer.toLowerCase()) {
            yield prisma.teamProgress.create({
                data: {
                    progress_id: (0, uuid_1.v4)(),
                    team_name,
                    question_id,
                    is_completed: true,
                    solved_at: new Date()
                }
            });
            return res.status(201).json({ message: 'Correct answer! Question marked as completed.' });
        }
        return res.status(400).json({ message: 'Incorrect answer.' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}));
app.get('/get-questions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questions = yield prisma.question.findMany({
            select: {
                question_id: true,
                question_text: true,
                question_description: true
            }
        });
        res.status(200).json(questions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/toggle-team-lock', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { team_name } = req.body;
    try {
        const team = yield prisma.team.findUnique({
            where: { team_name },
            select: { locked: true }
        });
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        const newLockStatus = !team.locked;
        yield prisma.team.update({
            where: { team_name },
            data: { locked: newLockStatus }
        });
        res.status(200).json({ message: `Team ${team_name} has been ${newLockStatus ? 'locked' : 'unlocked'}.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/team-locked', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { team_name } = req.body;
    try {
        const team = yield prisma.team.findUnique({
            where: { team_name },
            select: { locked: true }
        });
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.status(200).json({ team_name, locked: team.locked });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.get('/get-hints', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const hints = yield prisma.hint.findMany({
            select: {
                id: true,
                hintText: true,
                createdAt: true
            }
        });
        res.status(200).json(hints);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
wss.on('connection', (ws) => {
    console.log('New client connected');
    ws.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        const data = JSON.parse(message);
        if (data.type === 'hint') {
            const hintText = data.hintText;
            if (typeof hintText !== 'string' || hintText.trim() === '') {
                console.error('Invalid hintText:', hintText);
                return ws.send(JSON.stringify({ error: 'Invalid hintText provided' }));
            }
            try {
                wss.clients.forEach(client => {
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(JSON.stringify({ type: 'hint', hint: hintText }));
                    }
                });
                yield prisma.hint.create({
                    data: { hintText }
                });
            }
            catch (error) {
                console.error('Error saving hint:', error);
                ws.send(JSON.stringify({ error: 'Failed to save hint' }));
            }
        }
        if (data.type === 'lock' || data.type === 'unlock') {
            const isLocking = data.type === 'lock';
            const teamName = data.team_name;
            try {
                yield prisma.team.update({
                    where: { team_name: teamName },
                    data: { locked: isLocking }
                });
                wss.clients.forEach(client => {
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(JSON.stringify({ type: data.type, team_name: teamName, message: `Team ${teamName} ${isLocking ? 'locked' : 'unlocked'}!` }));
                    }
                });
            }
            catch (error) {
                console.error(`Error ${data.type} team:`, error);
                ws.send(JSON.stringify({ message: `Failed to ${data.type} team ${teamName}` }));
            }
        }
        if (data.type === 'lock_all' || data.type === 'unlock_all') {
            const isLockingAll = data.type === 'lock_all';
            try {
                yield prisma.team.updateMany({
                    data: { locked: isLockingAll }
                });
                wss.clients.forEach(client => {
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(JSON.stringify({ type: data.type, message: `All teams ${isLockingAll ? 'locked' : 'unlocked'}!` }));
                    }
                });
            }
            catch (error) {
                console.error(`Error ${data.type} all teams:`, error);
                ws.send(JSON.stringify({ message: `Failed to ${data.type} all teams` }));
            }
        }
    }));
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
app.listen(3000, () => {
    console.log('Server running on port 3000');
});

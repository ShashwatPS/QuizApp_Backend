import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import WebSocket, { Server as WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { TeamRequestBody, QuestionRequestBody, LoginRequestBody } from './interfaces';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const wss = new WebSocketServer({ port: 8080 });

app.use(express.json());
app.use(cors());

app.post('/lock-all-teams', async (req: Request, res: Response) => {
    try {
        await prisma.team.updateMany({
            data: { locked: true }
        });
        res.status(200).json({ message: 'All teams locked successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/unlock-all-teams', async (req: Request, res: Response) => {
    try {
        await prisma.team.updateMany({
            data: { locked: false }
        });
        res.status(200).json({ message: 'All teams unlocked successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/register-team', async (req: Request<{}, {}, TeamRequestBody>, res: Response) => {
    const { team_name, team_password, users } = req.body;
    try {
        const existingTeam = await prisma.team.findUnique({
            where: { team_name },
        });
        if (existingTeam) {
            return res.status(400).json({ error: 'Team name already exists' });
        }

        const newTeam = await prisma.team.create({
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
    } catch (error) {
        res.status(400).json({ error: 'User in another team' });
    }
});

app.post('/add-question', async (req: Request<{}, {}, QuestionRequestBody>, res: Response) => {
    const { question_text, question_description, answer } = req.body;
    try {
        const question = await prisma.question.create({
            data: {
                question_id: crypto.randomUUID(),
                question_text,
                question_description,
                answer
            }
        });
        res.status(201).json(question);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

app.post('/login-team', async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
    const { team_name, team_password } = req.body;
    try {
        const team = await prisma.team.findUnique({
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
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/submit-answer', async (req: Request<{}, {}, { team_name: string; question_id: string; answer: string }>, res: Response) => {
    const { team_name, question_id, answer } = req.body;
    try {
        const team = await prisma.team.findUnique({ where: { team_name } });
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        const teamProgress = await prisma.teamProgress.findFirst({
            where: { team_name, question_id },
            include: { question: true }
        });
        if (teamProgress) {
            if (teamProgress.is_completed) {
                return res.status(400).json({ message: 'This team has already submitted the correct answer for this question.' });
            }
            if (teamProgress.question.answer.toLowerCase() === answer.toLowerCase()) {
                await prisma.teamProgress.update({
                    where: { progress_id: teamProgress.progress_id },
                    data: { is_completed: true, solved_at: new Date() }
                });
                return res.status(200).json({ message: 'Correct answer! Question marked as completed.' });
            }
            return res.status(400).json({ message: 'Incorrect answer.' });
        }
        const question = await prisma.question.findUnique({ where: { question_id } });
        if (!question) {
            return res.status(404).json({ message: 'Question not found.' });
        }
        if (question.answer.toLowerCase() === answer.toLowerCase()) {
            await prisma.teamProgress.create({
                data: {
                    progress_id: uuidv4(),
                    team_name,
                    question_id,
                    is_completed: true,
                    solved_at: new Date()
                }
            });
            return res.status(201).json({ message: 'Correct answer! Question marked as completed.' });
        }
        return res.status(400).json({ message: 'Incorrect answer.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/get-questions', async (req: Request, res: Response) => {
    try {
        const questions = await prisma.question.findMany({
            select: {
                question_id: true,
                question_text: true,
                question_description: true
            }
        });
        res.status(200).json(questions);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/toggle-team-lock', async (req: Request, res: Response) => {
    const { team_name } = req.body;
    try {
        const team = await prisma.team.findUnique({
            where: { team_name },
            select: { locked: true }
        });
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        const newLockStatus = !team.locked;
        await prisma.team.update({
            where: { team_name },
            data: { locked: newLockStatus }
        });
        res.status(200).json({ message: `Team ${team_name} has been ${newLockStatus ? 'locked' : 'unlocked'}.` });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/team-locked', async (req: Request<{}, {}, { team_name: string }>, res: Response) => {
    const { team_name } = req.body;
    try {
        const team = await prisma.team.findUnique({
            where: { team_name },
            select: { locked: true }
        });
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.status(200).json({ team_name, locked: team.locked });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/get-hints', async (req: Request, res: Response) => {
    try {
        const hints = await prisma.hint.findMany({
            select: {
                id: true,
                hintText: true,
                createdAt: true
            }
        });
        res.status(200).json(hints);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});


wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    ws.on('message', async (message: string) => {
        const data = JSON.parse(message);

        if (data.type === 'hint') {
            const hintText = data.hintText;
            if (typeof hintText !== 'string' || hintText.trim() === '') {
                console.error('Invalid hintText:', hintText);
                return ws.send(JSON.stringify({ error: 'Invalid hintText provided' }));
            }
            try {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'hint', hint: hintText }));
                    }
                });

                await prisma.hint.create({
                    data: { hintText }
                });
            } catch (error) {
                console.error('Error saving hint:', error);
                ws.send(JSON.stringify({ error: 'Failed to save hint' }));
            }
        }


        if (data.type === 'lock' || data.type === 'unlock') {
            const isLocking = data.type === 'lock';
            const teamName = data.team_name;
            try {
                await prisma.team.update({
                    where: { team_name: teamName },
                    data: { locked: isLocking }
                });
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: data.type, team_name: teamName, message: `Team ${teamName} ${isLocking ? 'locked' : 'unlocked'}!` }));
                    }
                });
            } catch (error) {
                console.error(`Error ${data.type} team:`, error);
                ws.send(JSON.stringify({ message: `Failed to ${data.type} team ${teamName}` }));
            }
        }

        if (data.type === 'lock_all' || data.type === 'unlock_all') {
            const isLockingAll = data.type === 'lock_all';
            try {
                await prisma.team.updateMany({
                    data: { locked: isLockingAll }
                });
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: data.type, message: `All teams ${isLockingAll ? 'locked' : 'unlocked'}!` }));
                    }
                });
            } catch (error) {
                console.error(`Error ${data.type} all teams:`, error);
                ws.send(JSON.stringify({ message: `Failed to ${data.type} all teams` }));
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});

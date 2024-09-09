import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import WebSocket, { Server as WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const wss = new WebSocketServer({ port: 8080 });

app.use(express.json());

interface User {
    EnrollNo: string;
    name: string;
}

interface TeamRequestBody {
    team_name: string;
    team_password: string;
    users: User[];
}

app.post('/register-team', async (req: Request<{}, {}, TeamRequestBody>, res: Response) => {
    const { team_name, team_password, users } = req.body;
    try {
        const newTeam = await prisma.teams.create({
            data: {
                team_id: crypto.randomUUID(),
                team_name,
                team_password,
                users: {
                    create: users.map(user => ({
                        EnrollNo: user.EnrollNo,
                        name: user.name
                    }))
                }
            },
            include: {
                users: true
            }
        });
        res.status(201).json(newTeam);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

interface QuestionRequestBody {
    question_text: string;
    question_description: string;
    answer: string;
}

app.post('/add-question', async (req: Request<{}, {}, QuestionRequestBody>, res: Response) => {
    const { question_text, question_description, answer } = req.body;
    try {
        const question = await prisma.questions.create({
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


wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    ws.on('message', (message: string) => {
        const data = JSON.parse(message);
        if (data.type === 'hint') {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'hint', hint: data.hintText }));
                }
            });
        }

        if (data.type === 'lock') {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'lock', message: 'Website locked!' }));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});

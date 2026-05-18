import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export async function listCompanies(req: Request, res: Response): Promise<Response> {
    const companies = await prisma.company.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { tenants: true } } },
    });
    return res.json(companies);
}

export async function getCompany(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const company = await prisma.company.findUnique({
        where: { id },
        include: {
            tenants: {
                select: { id: true, name: true, slug: true, isActive: true, subscription: { select: { status: true, planName: true, priceMonthly: true } } },
            },
        },
    });
    if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
    return res.json(company);
}

export async function createCompany(req: Request, res: Response): Promise<Response> {
    const { name, personType, document, email, phone, address, city, state, zipCode, website, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

    const company = await prisma.company.create({
        data: { name, personType: personType || 'PJ', document: document || null, email: email || null, phone: phone || null, address: address || null, city: city || null, state: state || null, zipCode: zipCode || null, website: website || null, notes: notes || null },
    });
    return res.status(201).json(company);
}

export async function updateCompany(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { name, personType, document, email, phone, address, city, state, zipCode, website, notes } = req.body;

    const company = await prisma.company.update({
        where: { id },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(personType !== undefined ? { personType } : {}),
            ...(document !== undefined ? { document: document || null } : {}),
            ...(email !== undefined ? { email: email || null } : {}),
            ...(phone !== undefined ? { phone: phone || null } : {}),
            ...(address !== undefined ? { address: address || null } : {}),
            ...(city !== undefined ? { city: city || null } : {}),
            ...(state !== undefined ? { state: state || null } : {}),
            ...(zipCode !== undefined ? { zipCode: zipCode || null } : {}),
            ...(website !== undefined ? { website: website || null } : {}),
            ...(notes !== undefined ? { notes: notes || null } : {}),
        },
    });
    return res.json(company);
}

export async function deleteCompany(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    // unlink tenants first
    await prisma.tenant.updateMany({ where: { companyId: id }, data: { companyId: null } });
    await prisma.company.delete({ where: { id } });
    return res.status(204).send();
}

export async function linkTenantToCompany(req: Request, res: Response): Promise<Response> {
    const { id: tenantId } = req.params;
    const { companyId } = req.body; // null to unlink

    const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { companyId: companyId || null },
        select: { id: true, name: true, companyId: true },
    });
    return res.json(tenant);
}

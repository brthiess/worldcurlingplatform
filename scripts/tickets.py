"""Validate and coordinate the published local task graph; never use drafts."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / '.scratch/world-curling-platform'
GRAPH = TRACKER / 'tickets.json'
STATE = TRACKER / 'execution-state.json'


def read_graph():
    graph = json.loads(GRAPH.read_text(encoding='utf-8-sig'))
    if hashlib.sha256((TRACKER / 'spec.md').read_bytes()).hexdigest().upper() != graph['source_spec_sha256']:
        raise ValueError('Authoritative specification differs from the published task graph source')
    tickets = {t['id']: t for t in graph['tickets']}
    if len(tickets) != 47:
        raise ValueError('Expected 47 approved published tickets')
    visiting, visited = set(), set()

    def visit(identifier):
        if identifier in visiting:
            raise ValueError(f'Dependency cycle: {identifier}')
        if identifier in visited:
            return
        visiting.add(identifier)
        ticket = tickets[identifier]
        if ticket['blocked_by'] != [f'WCP-{n:03}' for n in ticket['deps']]:
            raise ValueError(f'Conflicting blocker fields: {identifier}')
        issue = TRACKER / ticket['path']
        if issue.parent != TRACKER / 'issues' or not issue.is_file():
            raise ValueError(f'Not a published issue: {identifier}')
        text = issue.read_text(encoding='utf-8-sig')
        for field, value in [('id', identifier), ('status', ticket['status'])]:
            if not re.search(rf'^{field}: {re.escape(value)}$', text, re.M):
                raise ValueError(f'Issue {field} mismatch: {identifier}')
        for requirement in ['Unit testing', 'Database/API verification', 'Frontend quality']:
            if requirement not in text:
                raise ValueError(f'Missing {requirement}: {identifier}')
        for dependency in ticket['blocked_by']:
            visit(dependency)
        visiting.remove(identifier)
        visited.add(identifier)
    for identifier in tickets:
        visit(identifier)
    return graph, tickets


def frontier(tickets):
    return [t['id'] for t in tickets.values() if t['status'] == 'ready-for-agent'
            and all(tickets[d]['status'] == 'completed' for d in t['blocked_by'])]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['validate', 'status', 'start', 'block', 'complete'])
    parser.add_argument('ticket', nargs='?')
    parser.add_argument('--reason')
    parser.add_argument('--commit')
    parser.add_argument('--evidence')
    args = parser.parse_args()
    graph, tickets = read_graph()
    if args.action in ['start', 'block', 'complete']:
        if args.ticket not in tickets:
            parser.error('A published ticket ID is required')
        ticket = tickets[args.ticket]
        if args.action == 'start':
            if args.ticket not in frontier(tickets):
                raise ValueError('Ticket is not on the unblocked frontier')
            if sum(t['status'] == 'in-progress' for t in tickets.values()) >= 3:
                raise ValueError('Three-implementer concurrency bound reached')
            status = 'in-progress'
        elif args.action == 'block':
            if not args.reason:
                parser.error('--reason is required')
            status = 'blocked'
            ticket['execution_blocker'] = args.reason
        else:
            if ticket['status'] != 'in-progress':
                raise ValueError('Only an in-progress ticket may complete')
            if not all(tickets[d]['status'] == 'completed' for d in ticket['blocked_by']):
                raise ValueError('Dependencies are incomplete')
            if not args.commit or not args.evidence:
                parser.error('Completion requires integrated --commit and reviewed --evidence')
            evidence = ROOT / args.evidence
            if not evidence.is_file() or evidence.resolve().parent != (ROOT / 'docs/verification').resolve():
                raise ValueError('Evidence must be a file under docs/verification')
            subprocess.run(['git', 'merge-base', '--is-ancestor', args.commit, 'HEAD'], cwd=ROOT, check=True)
            ticket['completion'] = {'commit': args.commit, 'evidence': args.evidence}
            status = 'completed'
        issue = TRACKER / ticket['path']
        text = issue.read_text(encoding='utf-8-sig')
        text = re.sub(r'^status: .+$', f'status: {status}', text, count=1, flags=re.M)
        text = re.sub(r'^\*\*Status:\*\* .+$', f'**Status:** {status}', text, count=1, flags=re.M)
        if status == 'completed':
            text = text.replace('- [ ] ', '- [x] ')
        issue.write_bytes(text.encode('utf-8'))
        ticket['status'] = status
        GRAPH.write_bytes((json.dumps(graph, indent=2, ensure_ascii=False) + '\n').encode('utf-8'))
        state = json.loads(STATE.read_text(encoding='utf-8-sig'))
        state.update(phase='implementation', status='active', updated_at=datetime.now(timezone.utc).isoformat())
        state['tickets_started'] = [t['id'] for t in tickets.values() if t['status'] != 'ready-for-agent']
        state['tickets_completed'] = [t['id'] for t in tickets.values() if t['status'] == 'completed']
        state['active_tickets'] = [t['id'] for t in tickets.values() if t['status'] == 'in-progress']
        state['frontier'] = frontier(tickets)
        worktrees = state.setdefault('git', {}).setdefault('worktrees_created', [])
        ticket_worktree = f'.worktrees/{args.ticket}'
        if (ROOT / ticket_worktree).is_dir() and ticket_worktree not in worktrees:
            worktrees.append(ticket_worktree)
        state['verification'] = {
            'policy': 'Only completed tickets have reviewed required-check evidence; each record is limited to its ticket scope.',
            'records': {t['id']: t['completion'] for t in tickets.values()
                        if t['status'] == 'completed'}
        }
        state.setdefault('events', []).append({'time': state['updated_at'], 'ticket': args.ticket,
                                              'status': status, 'reason': args.reason,
                                              'commit': args.commit, 'evidence': args.evidence})
        STATE.write_bytes((json.dumps(state, indent=2, ensure_ascii=False) + '\n').encode('utf-8'))
    print(json.dumps({'count': len(tickets), 'frontier': frontier(tickets),
                      'active': [t['id'] for t in tickets.values() if t['status'] == 'in-progress'],
                      'completed': [t['id'] for t in tickets.values() if t['status'] == 'completed'],
                      'blocked': [t['id'] for t in tickets.values() if t['status'] == 'blocked']}, indent=2))


if __name__ == '__main__':
    main()

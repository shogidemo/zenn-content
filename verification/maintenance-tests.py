from pathlib import Path
import copy, hashlib, json, os, subprocess, sys, tempfile
import yaml
repo = Path(sys.argv[1]).resolve()
base_rev = 'ca4f8a7cf0665dada48794e375ba543f61581d72'
wf = yaml.safe_load((repo / '.github/workflows/dependabot-auto-merge.yml').read_text())
script = wf['jobs']['label-major']['steps'][1]['run']
assert wf['jobs']['label-major']['concurrency']['cancel-in-progress'] is False
assert 'github.event.pull_request.number' in wf['jobs']['label-major']['concurrency']['group']
base = yaml.safe_load(subprocess.check_output(['git','show',base_rev+':.github/workflows/dependabot-auto-merge.yml'], cwd=repo, text=True))
base['jobs']['validate-actions']['steps'][1] = copy.deepcopy(wf['jobs']['validate-actions']['steps'][1])
base['jobs']['label-major']['steps'][1] = copy.deepcopy(wf['jobs']['label-major']['steps'][1])
base['jobs']['label-major']['concurrency'] = copy.deepcopy(wf['jobs']['label-major']['concurrency'])
assert base == wf, 'Other workflow behavior changed'
for path in (repo / '.github/workflows').glob('*.yml'):
    data = yaml.safe_load(path.read_text())
    for job in data['jobs'].values():
        for step in job.get('steps', []):
            if 'run' in step:
                subprocess.run(['bash','-n'], input=step['run'], text=True, check=True)
old = yaml.safe_load(subprocess.check_output(['git','show',base_rev+':.github/dependabot.yml'], cwd=repo, text=True))
new = yaml.safe_load((repo / '.github/dependabot.yml').read_text())
for entry in old['updates']:
    entry['schedule']['interval'] = 'monthly'
    entry['schedule'].pop('day')
assert old == new, 'Dependabot changed beyond regular schedule'
assert (repo / '.github/CODEOWNERS').read_bytes() == subprocess.check_output(['git','show',base_rev+':.github/CODEOWNERS'],cwd=repo)
lock=json.loads((repo / 'package-lock.json').read_text())
assert lock['lockfileVersion'] == 3
for name,version in {'node_modules/fast-uri':'3.1.8','node_modules/prh/node_modules/diff':'4.0.4','node_modules/smol-toml':'1.9.1'}.items():
    assert lock['packages'][name]['version']==version
marker='<!-- dependabot-major-warning -->'
legacy='## :warning: メジャーバージョンアップデート'
def comment(id,body,author='github-actions[bot]'):
    return {'id':id,'body':body,'user':{'login':author}}
with tempfile.TemporaryDirectory(prefix='zenn-major-test-') as temp:
    root=Path(temp); bindir=root/'bin';bindir.mkdir()
    gh=bindir/'gh'
    gh.write_text('''#!/usr/bin/env python3
import json, os, sys
args=sys.argv[1:]
with open(os.environ['CALLS'],'a') as f:f.write(json.dumps(args)+'\\n')
assert args[0]=='api'
if '--method' not in args:
    assert '--paginate' in args and '--slurp' in args
    if os.environ.get('GET_FAIL')=='1':sys.exit(1)
    print(open(os.environ['FIXTURE']).read())
else:
    method=args[args.index('--method')+1]
    assert method in ('POST','PATCH')
    if os.environ.get('WRITE_FAIL')=='1':sys.exit(1)
    print('{}')
''');gh.chmod(0o700)
    sentinel=root/'should-not-exist'
    deps='test-pkg $(touch '+str(sentinel)+'); "quoted"\nsecond line'
    cases=[('new',[[]],'POST',None),('repeat',[[comment(42,marker)]],'PATCH','42'),('legacy',[[comment(55,legacy+'\nold')]],'PATCH','55'),('other-author',[[comment(10,marker,'human'),comment(11,'Other bot note')]],'POST',None),('pagination',[[comment(5,'Other')],[comment(60,marker)]],'PATCH','60'),('duplicates',[[comment(2,legacy),comment(3,marker)]],'PATCH','3')]
    for name,fixture,method,id in cases:
        fixturefile=root/'fixture.json';fixturefile.write_text(json.dumps(fixture))
        calls=root/'calls.jsonl';calls.write_text('')
        env={'PATH':str(bindir)+os.pathsep+os.environ['PATH'],'CALLS':str(calls),'FIXTURE':str(fixturefile),'GITHUB_REPOSITORY':'test/repo','PR_NUMBER':'101','DEPENDENCY_NAMES':deps,'GH_TOKEN':'fake-test-token'}
        result=subprocess.run(['bash','-e','-o','pipefail','-c',script],env=env,capture_output=True,text=True)
        assert result.returncode==0,(name,result.stderr)
        logged=[json.loads(x) for x in calls.read_text().splitlines()]
        assert len(logged)==2
        last=logged[-1];assert last[last.index('--method')+1]==method
        assert ('repos/test/repo/issues/comments/'+id if id else 'repos/test/repo/issues/101/comments') in last
        assert marker in last[-1] and deps in last[-1]
        assert not sentinel.exists(), 'Dependency names evaluated as commands'
        print('PASS:',name)
    for fail in ['GET_FAIL','WRITE_FAIL']:
        calls.write_text('');env[fail]='1'
        result=subprocess.run(['bash','-e','-o','pipefail','-c',script],env=env,capture_output=True,text=True)
        assert result.returncode!=0
        logged=[json.loads(x) for x in calls.read_text().splitlines()]
        assert len(logged)==(1 if fail=='GET_FAIL' else 2)
        env.pop(fail);print('PASS:',fail)
print('PASS: scope/schedule/CODEOWNERS/lock/YAML/shell; 8 mocked comment cases; no external writes')
print('comment run SHA256:',hashlib.sha256(script.encode()).hexdigest())

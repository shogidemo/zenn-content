from pathlib import Path
import hashlib,json,os,subprocess,sys,tempfile
repo=Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='zenn-scheduled-fixture-') as temp:
    root=Path(temp);(root/'articles').mkdir()
    guard=root/'deny-network.cjs';log=root/'network-attempts';log.write_text('')
    guard.write_text("const fs=require('fs');const deny=()=>{fs.appendFileSync(process.env.NETWORK_LOG,'attempt\\n');throw new Error('Network disabled in synthetic dry-run');};global.fetch=deny;for(const p of ['node:http','node:https']){const m=require(p);m.request=deny;m.get=deny;}")
    env=dict(os.environ);env.update(NODE_OPTIONS='--require '+str(guard),NETWORK_LOG=str(log),ZENN_USERNAME='migration-test')
    for key in ['X_API_KEY','X_API_KEY_SECRET','X_ACCESS_TOKEN','X_ACCESS_TOKEN_SECRET','QIITA_TOKEN','GITHUB_OUTPUT']:
        env.pop(key,None)
    def run(name,args=(),extra=None):
        result=subprocess.run(['node',str(repo/'.github/scripts'/name),*args],cwd=root,env={**env,**(extra or {})},text=True,capture_output=True)
        assert result.returncode==0,(name,result.stderr)
        assert log.read_text()=='','Network request attempted'
        return result.stdout
    for slug,date,shared in [('past','2000-01-01 12:00','false'),('future','2099-01-01 12:00','false'),('shared','2000-01-01 12:00','true')]:
        (root/'articles'/f'{slug}.md').write_text(f'---\ntitle: "Synthetic fixture"\ntopics: [node]\npublished: true\npublished_at: "{date}"\nx_shared: {shared}\nqiita_sync: true\n---\nSynthetic content\n')
    before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'articles').glob('*.md')}
    x=json.loads(run('find-articles.js',['--scheduled']));assert [a['slug'] for a in x]==['past']
    run('post-to-x.js',['--dry-run','--mark-shared'],{'ARTICLES':json.dumps(x)})
    q=json.loads(run('find-articles-for-qiita.js',extra={'EVENT_NAME':'schedule'}));assert 'future' not in [a['slug'] for a in q]
    converted=run('convert-to-qiita.js',extra={'ARTICLES':json.dumps(q)})
    run('post-to-qiita.js',['--dry-run'],{'CONVERTED_ARTICLES':converted})
    after={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'articles').glob('*.md')}
    assert before==after,'Dry-run modified article metadata'
    print('PASS: synthetic scheduled X/Qiita detection/conversion/dry-run; no network or article modifications')

CREAM : 

We’re planning to create a marketplace for AI content creators. “CREAM” is the name that we decided on. This is to symbolize the “cream layer”, implying that we’d bring out the cream layer of all the creator talent pool to serve the clients and bring in equally top tier deals to our creators. 

So, before we dig into what the platform is, there are some key challenges that any new platform has to face : 
1. Why should users trust a new platform?
2. How do they know if their data is secure?
3. How can we make sure to avoid fraudulent transactions?
4. How do we get around data leaks and hacks without the huge initial capital?
5. How do we hold any wrongdoers accountable while respecting the privacy of other users?

These are architecture level issues, now there are conceptual and functional issues 

Clients might not be able to perfectly communicate their requirements by themselves, because communication isn’t everyone’s cup of tea.
Creators might experience blocks and blank periods where they can’t churn out new ideas and concepts. 
Both creator time and client’s money are extremely valuable, so both of them would try their best to spend as little as they can, to avoid losses.
AI is notoriously prone to hallucinations and lost contexts. LLMs just make probabilistic guesses, so, there’s no guarantee that they’d stick to the right context. 


And more….  So, here’s what we landed on 	QQ

We use reputable third party service providers wherever possible and necessary to minimize the security risks of user data, privacy, passwords, payments and other sensitive information like the content they share on our platform. 


That includes : 


Third party SSO like google, apple, etc via Supabase for authentication. This makes sure that we don’t have to store and secure passwords and other such critical info, and users need not worry about the same when trying to trust our platform. 

To make sure that we protect the clients and creators from fake identities and curb fraudulent practices, we enforce accountability and invoke a sense of responsibility by collecting government IDs of every client and creator. But this raises a new critical red flag. Why would anyone trust a new company, especially an online tool with their government IDs when they can’t even risk their sign in info?

To solve this, just like we used third parties for authentication, we use the government to verify the identity for us, through Digilocker. This way, clients never have to upload their IDs to our servers and worry about them being misused. 

In a similar fashion we use credible third party payment gateways like Razorpay, ICICI, HDFC, etc to handle the payments so that clients never have to worry about their payment info being stolen.

Finally, storing their digital content, now this is tricky because it is inevitable to share the content with creators, and creators must share samples of their creative content with the client, so even end to end encryptions won’t solve the issue, because clients and creators themselves can potentially misuse this content. This is where we use legal agreements, terms, contracts and policies to govern and handle such situations like any other platform. We explicitly warn users against such practices before payments or refunds, and during sign up. We use virtual contracts at the start and end of the outsourcing contract, and they aren’t bypassable. So, any further progress is gated by these contracts and agreements. 


And for the functional issues : 

We use language models to converse with the clients to proactively ask about their requirements, so that even if the clients themselves can’t structurally explain things, structure can be extracted through friendly natural language conversations. 

These language models are purely conversational purposes, they do not search for creators themselves and this is by design. Because the fundamental problems are : 
Programs can run database queries but can’t understand user requirements by themselves.
AI can’t process an enormous continuously updating database of the creator pool without context overflows and hallucinations.
Users can’t program queries or communicate structural data needed by the programs to perform queries. 
Creators are most often misused and cheated on several online platforms where they work and deliver but payment never reaches their accounts.

So, to solve all of these in one shot, we use: 
AI to handle natural conversations, curating the right briefs and offers and export queries to find matching creators.
Programs to execute the queries over the dynamic database.
AI to parse the results and explain them to the user in a natural, user friendly interface. 
This makes the best use of each of them while avoiding their flaws.
Then, the user browses profiles and portfolios of these creators, shortlists them, and sends them offers. 
Creators then receive these offers, while the AI explains these briefs to the users, the exact context from the user conversation is preserved and passed to the AI at the creator’s end, so that it picks up every fine detail while explaining the requirement to the creator.
This preservation and retrieval of the exact conversation and context is the key differentiator that other such platforms didn’t yet possess. This makes it seem as if AI is a live third person in the conversation, that interprets things between the users, without them having to be good at communication at all.
Then, the client and creator connect with each other to discuss and negotiate the contract details, the LLM is the live witness in this entire conversation, and this data can also be used to finetune and train the AI to be better at understanding these situations. 
Because the LLM is a live witness, it can easily draft contracts based on their agreed terms, and this is where the outsourcing starts. Both parties need to sign this virtual contract before any payment or work begins.
After this, clients make the payment in advance ( through the third parties like we established ) and this is then withheld by the platform until the contract ends to protect the client’s money from fraudulent creators or mishaps. This also gives the creators confidence to begin working, because the client already paid for the work. 
Once the creators have enough satisfactory samples, they then get back to the client to show them, but these samples are heavily watermarked both with the platform’s name and the creators name so that it explicitly shows who and where the content came from and belongs to. These watermarks are both visible and invisible, including plans to use SynthIDs in the future. This makes sure that any clients with malicious intents can’t record or capture the content and use it anywhere without the creator’s permission. 
After any necessary and agreed upon revisions as outlined in the contract, the clients either approve or reject the final output. We make the rejections weakly defensible by design because creators are mandatorily required to show samples beforehand, and work continues only after the client confirms them. However, there might be cases where the final output is genuinely bad, and doesn’t match the samples. In such cases, the client gets the refund, either full or partial, based on the individual case details, which will be handled by both AI and human specialists. 
If the content is approved, they sign a contract end agreement ( virtual again ) that protects both parties from future disputes and acts as an evidence of mutual satisfaction, in extreme cases, they can also sign a cancellation agreement, which also needs to be mutual, and our team personally takes care of such agreements to make sure neither party exploits the others. So, this isn’t automated, and is purely based on human scrutiny.
During all these important legal and payment / refund related stages, both parties are shown clear guidelines and terms that show what actions are prohibited and what scope is established by the document. They must mandatorily approve this before they proceed.
That’s it, then they part their ways and start new journeys, and we add the project to their user metadata and portfolios, this will later be used during ranking the creators. 
Certain things can’t be forced into structure, so our database has embedded semantic vectors to cover metadata like we just spoke about, which is then used by the AI during the retrieval process. 

Apart from these, we have certain strategies to target and acquire users into the new platform:
We target young, creative and inexperienced talent and conduct challenges and competitions to give them a chance to prove their creative genius and showcase it to the world. This breaks the traditional experience trap, because creativity, especially when technically assisted with AI, has no rules. 
Similar to young creators, we hunt for young clients, who are hungry and unhinged enough to try radical, new age content and break the molds.
Both of these can make an explosive impact if marketed in the right way, creating tons of buzz around the platform and the content, while we work with the most comfortable and risk free segment of clients, avoiding aged enterprises that can’t take risks. 

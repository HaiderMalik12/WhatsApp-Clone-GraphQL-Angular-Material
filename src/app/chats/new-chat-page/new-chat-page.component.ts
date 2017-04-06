import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs/Observable';

import * as update from 'immutability-helper';
import gql from 'graphql-tag';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/do';

import { AuthService } from '../../auth/auth.service';
import { GetAllMembersQuery, StartChatMutation, GetAllChatsQuery } from '../../graphql';

const getAllMembersQuery = require('graphql-tag/loader!../../graphql/get-all-members.graphql');
const getAllChatsQuery = require('graphql-tag/loader!../../graphql/get-all-chats.graphql');

@Component({
  selector: 'app-new-chat-page',
  templateUrl: './new-chat-page.component.html',
  styleUrls: ['./new-chat-page.component.scss']
})
export class NewChatPageComponent implements OnInit {
  contacts: Observable<any[]>;
  allMembers: GetAllMembersQuery.AllMembers[];
  loggedInUser: any;
  selectDisabled = false;

  constructor(
    private router: Router,
    private apollo: Apollo,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.loggedInUser = this.auth.getUser();

    this.contacts = this.apollo.query<GetAllMembersQuery.Result>({
      query: getAllMembersQuery,
      variables: {
        member: this.loggedInUser.id
      }
    })
      .do(result => this.allMembers = result.data.allMembers)
      .map(result => result.data.allMembers);
  }

  onSelect(contact: any) {
    this.selectDisabled = true;

    const member = this.findMember(contact.id);

    if (!member) {
      this.selectDisabled = false;
      return;
    }

    if (member.chats && member.chats.length) {
      // go to the chat that already exists
      this.navigateToChat(member.chats[0].id);
      return;
    }

    // create a new chat
    const variables = {
      members: [
        this.loggedInUser.id,
        member.id
      ],
      author: this.loggedInUser.id,
    };

    this.apollo.mutate<StartChatMutation.Result>({
      mutation: gql`
        mutation startChat($members: [ID!]!, $author: ID!) {
          createChat(
            membersIds: $members
          ){
            id
            date: createdAt
            messages(last: 1) {
              content
              author {
                id
                name
              }
            }
            members(filter: {
              id_not: $author
            }) {
              id
              name
              image
            }
          }
        }

      `,
      variables,
      update: (proxy, result: any) => {
        const options = {
          query: getAllChatsQuery,
          variables: {
            member: this.loggedInUser.id,
          },
        };
        const data = proxy.readQuery<GetAllChatsQuery.Result>(options);

        proxy.writeQuery({
          ...options,
          data: {
            ...data,
            allChats: [result.data.createChat, ...data.allChats],
          },
        });
      },
    }).subscribe(({data}) => {
      this.navigateToChat(data.createChat.id);
    });
  }

  private navigateToChat(id: string) {
    this.router.navigate(['/chat', id]);
  }

  private findMember(id: string) {
    return this.allMembers.find(member => member.id === id);
  }

}
